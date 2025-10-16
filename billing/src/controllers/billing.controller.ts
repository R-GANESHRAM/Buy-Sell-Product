import {repository} from '@loopback/repository';
import {post,get, param,response,requestBody,HttpErrors,
} from '@loopback/rest';
import {CartRepository,
  CartitemsRepository,
  ProductsRepository,
  BillingRepository,
  BillingItemsRepository,UserRepository,
} from '../repositories';
import {Billing, BillingItems} from '../models';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';

export class BillingController {
  constructor(
    @repository(CartRepository) private cartRepo: CartRepository,
    @repository(CartitemsRepository)
    private cartItemRepo: CartitemsRepository,
    @repository(ProductsRepository) private productRepo: ProductsRepository,
    @repository(BillingRepository) private billingRepo: BillingRepository,
    @repository(BillingItemsRepository)
    private billingItemRepo: BillingItemsRepository,
    @repository(UserRepository) private userRepo: UserRepository,
  ) {}

  // 1️ Generate Bill for Cart
  @post('/billing/{cartId}')
  async generateBill(@param.path.number('cartId') cartId: number) {
    const cart = await this.cartRepo.findById(cartId);
    if (cart.status === 'CHECKED_OUT') {
      throw new Error('Cart already checked out');
    }

    const items = await this.cartItemRepo.find({where: {cart_id: cartId}});
    if (items.length === 0) throw new Error('Cart is empty');

    let totalAmount = 0;
    for (const item of items) {
      totalAmount += item.quantity * item.price_at_add;
    }

    const invoiceNo = 'INV-' + Date.now();
    const billing = await this.billingRepo.create({
      cart_id: cartId,
      buyer_id: cart.buyer_id,
      total_amount: totalAmount,
      invoice_number: invoiceNo,
    } as Billing);

    for (const item of items) {
      await this.billingItemRepo.create({
        billing_id: billing.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price_each: item.price_at_add,
        total_price: item.quantity * item.price_at_add,
      } as BillingItems);

      const product = await this.productRepo.findById(item.product_id);
      await this.productRepo.updateById(product.id!, {
        stock: product.stock - item.quantity,
      });
    }

    await this.cartRepo.updateById(cartId, {status: 'CHECKED_OUT'});
    return {message: 'Billing generated successfully', billing};
  }

  // 2️ Export Billing as CSV
  @get('/billing/{billingId}/csv')
  @response(200, {
    description: 'CSV file download',
    content: {'text/csv': {schema: {type: 'string'}}},
  })
  async exportBillingCSV(@param.path.number('billingId') billingId: number) {
    const billing = await this.billingRepo.findById(billingId);
    const items = await this.billingItemRepo.find({
      where: {billing_id: billingId},
    });

    const csvHeaders = 'ProductID,Quantity,PriceEach,TotalPrice\n';
    const csvRows = items
      .map(i => `${i.product_id},${i.quantity},${i.price_each},${i.total_price}`)
      .join('\n');
    const csvData = csvHeaders + csvRows;

    const csvDir = path.join(__dirname, '../../../Billingincsv');
    if (!fs.existsSync(csvDir)) fs.mkdirSync(csvDir, {recursive: true});
    const filePath = path.join(
      csvDir,
      `invoice_${billing.invoice_number}.csv`,
    );
    fs.writeFileSync(filePath, csvData);

    return csvData;
  }

  // 3️ Generate PDF Report by Date Range (POST)
  @post('/billing/report')
  @response(200, {
    description: 'Transaction PDF Report Generated',
    content: {'application/pdf': {schema: {type: 'string', format: 'binary'}}},
  })
  async generateReport(
    @requestBody() payload: {start_time: string; end_time: string},
  ) {
    try {
      const {start_time, end_time} = payload;
      const start = new Date(start_time);
      const end = new Date(end_time);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new HttpErrors.BadRequest('Invalid date format');
      }

      const billings = await this.billingRepo.find({
        where: {
          and: [
            {created_at: {gte: start.toISOString()}},
            {created_at: {lte: end.toISOString()}},
          ],
        },
      });

      if (billings.length === 0) {
        throw new HttpErrors.NotFound('No transactions found in the given range');
      }

      const reportsDir = path.join(__dirname, '../../../Reports');
      if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, {recursive: true});

      const reportPath = path.join(
        reportsDir,
        `transaction_report_${Date.now()}.pdf`,
      );

      const doc = new PDFDocument({margin: 40});
      const stream = fs.createWriteStream(reportPath);
      doc.pipe(stream);

      doc.fontSize(18).text('Transaction Summary Report', {align: 'center'});
      doc.moveDown();
      doc.fontSize(12).text(`From: ${start.toLocaleString()}`);
      doc.text(`To: ${end.toLocaleString()}`);
      doc.moveDown();

      doc.fontSize(14).text('Transaction Details:', {underline: true});
      doc.moveDown(0.5);

      for (const billing of billings) {
        const billingItems = await this.billingItemRepo.find({
          where: {billing_id: billing.id},
        });
        let sellerId = 'Unknown';
        if (billingItems.length > 0) {
          const firstProd = await this.productRepo.findById(
            billingItems[0].product_id,
          );
          sellerId = firstProd.seller_id.toString();
        }

        doc
          .fontSize(11)
          .text(
            `Billing ID: ${billing.id} | Buyer ID: ${billing.buyer_id} | Seller ID: ${sellerId} | Products: ${billingItems.length} | Total: ₹${billing.total_amount} | Date: ${billing.created_at}`,
          );
        doc.moveDown(0.5);
      }

      doc.end();
      await new Promise(resolve => stream.on('finish', resolve));

      return {
        message: 'Transaction report generated successfully',
        filePath: reportPath,
      };
    } catch (error) {
      console.error('Error generating report:', error);
      throw new HttpErrors.InternalServerError('Failed to generate transaction report');
    }
  }

  // 4️⃣ Generate Report (GET)
  @get('/report/pdf')
  @response(200, {
    description: 'PDF Transaction Report',
    content: {'application/pdf': {schema: {type: 'string', format: 'binary'}}},
  })
  async generatedReport(
    @param.query.string('start_time') start_time: string,
    @param.query.string('end_time') end_time: string,
  ) {
    try {
      const startDate = new Date(start_time);
      const endDate = new Date(end_time);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new HttpErrors.BadRequest('Invalid date format');
      }

      const billings = await this.billingRepo.find({
        where: {
          and: [
            {created_at: {gte: startDate.toISOString()}},
            {created_at: {lte: endDate.toISOString()}},
          ],
        },
      });

      if (billings.length === 0) {
        throw new HttpErrors.NotFound('No billing records found in this range');
      }

      const reportsDir = path.join(__dirname, '../../../Reports');
      if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, {recursive: true});

      const pdfPath = path.join(
        reportsDir,
        `transaction_report_${Date.now()}.pdf`,
      );
      const doc = new PDFDocument({margin: 40});
      const writeStream = fs.createWriteStream(pdfPath);
      doc.pipe(writeStream);

      // Header
      doc.fontSize(18).text('Transaction Report', {align: 'center'});
      doc.moveDown(0.5);
      doc.fontSize(12).text(`From: ${startDate.toLocaleString()}`, {
        align: 'center',
      });
      doc.text(`To: ${endDate.toLocaleString()}, {align: 'center'}`);
      doc.moveDown(1);

      // Table headers
      doc.font('Helvetica-Bold');
      const headerY = doc.y;
      doc.text('ID', 50, headerY);
      doc.text('Buyer', 100, headerY);
      doc.text('Invoice No', 220, headerY);
      doc.text('Total (₹)', 370, headerY);
      doc.text('Date', 460, headerY);
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);
      doc.font('Helvetica');

      let y = doc.y;
      const rowGap = 20;
      for (const billing of billings) {
        const items = await this.billingItemRepo.find({
          where: {billing_id: billing.id},
        });
        const buyer = await this.userRepo.findById(billing.buyer_id);
        const totalCost = items.reduce(
          (sum, i) => sum + Number(i.total_price || 0),
          0,
        );
        const dateValue = billing.created_at
          ? new Date(billing.created_at).toLocaleString()
          : '-';

        doc.text(`${billing.id}, 50, y`);
        doc.text(`${buyer?.name || '-'}, 100, y`);
        doc.text(`${billing.invoice_number || '-'}, 220, y`);
        doc.text(`${totalCost.toFixed(2)}, 370, y`);
        doc.text(`${dateValue}, 460, y`);

        y += rowGap;
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
      }

      doc.moveDown(2);
      doc.font('Helvetica-Bold').text('End of Report', {align: 'center'});
      doc.end();

      return new Promise((resolve, reject) => {
        writeStream.on('finish', () => {
          const buffer = fs.readFileSync(pdfPath);
          resolve(buffer);
        });
        writeStream.on('error', reject);
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new HttpErrors.InternalServerError('Failed to generate PDF report');
    }
  }
}
