import {repository} from '@loopback/repository';
import {post, get, param, response,requestBody} from '@loopback/rest';
import {CartRepository, CartitemsRepository, ProductsRepository, BillingRepository, BillingItemsRepository, UserRepository} from '../repositories';
import {Billing, BillingItems} from '../models';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit'

export class BillingController {
  constructor(
    @repository(CartRepository) private cartRepo: CartRepository,
    @repository(CartitemsRepository) private cartItemRepo: CartitemsRepository,
    @repository(ProductsRepository) private productRepo: ProductsRepository,
    @repository(BillingRepository) private billingRepo: BillingRepository,
    @repository(BillingItemsRepository) private billingItemRepo: BillingItemsRepository,
    @repository(UserRepository) private userRepo:UserRepository
  ) {}

  // 1. Checkout Cart & Generate Billing
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

    // Insert billing items and update stock
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

    // Mark cart as checked out
    await this.cartRepo.updateById(cartId, {status: 'CHECKED_OUT'});

    return {message: 'Billing generated successfully', billing};
  }

  // 2. Export Billing to CSV
  @get('/billing/{billingId}/csv')
  @response(200, {
    description: 'CSV file download',
    content: {'text/csv': {schema: {type: 'string'}}},
  })
  async exportBillingCSV(@param.path.number('billingId') billingId: number) {
    const billing = await this.billingRepo.findById(billingId);
    const items = await this.billingItemRepo.find({where: {billing_id: billingId}});

    const csvHeaders = 'ProductID,Quantity,PriceEach,TotalPrice\n';
    const csvRows = items.map(i => `${i.product_id},${i.quantity},${i.price_each},${i.total_price}`).join('\n');
    const csvData = csvHeaders + csvRows;

    const filePath = path.join(__dirname, `../../../export/invoice_${billing.invoice_number}.csv`);
    fs.writeFileSync(filePath, csvData);

    return csvData; // Directly returning as response for simplicity
  }
  @get('/report/pdf')
  @response(200, {
    description: 'PDF Transaction Report',
    content: {'application/pdf': {schema: {type: 'string', format: 'binary'}}},
  })
  async generatedReport(
    @requestBody() payload: {start_time: string; end_time: string}
  ) {
    const startDate = new Date(payload.start_time);
    const endDate = new Date(payload.end_time);

    // 1. Fetch billing records within time range
    const billings = await this.billingRepo.find({
      where: {
        created_at: {
          between: [startDate.toISOString(), endDate.toISOString()],
        },
      },
    });

    // 2. Prepare PDF document
    const pdfPath = path.join(__dirname, `../../../export/transaction_report_${Date.now()}.pdf`);
    const doc = new PDFDocument({margin: 40});
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    // 3. PDF Header
    doc.fontSize(18).text('Transaction Report', {align: 'center'});
    doc.moveDown(0.5);
    doc.fontSize(12).text(`From: ${startDate.toLocaleString()}`, {align: 'center'});
    doc.text(`To: ${endDate.toLocaleString()}`, {align: 'center'});
    
    const header=100;
    // 4. Table Headers
    doc.font('Helvetica-Bold');
    doc.fontSize(12).text('ID', 50,header);
    doc.text('Buyer ID', 90,header);
    doc.text('Invoice No', 200,header);
    doc.text('Total Cost', 400,header);
    doc.text('Date/Time', 500,header);
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    doc.font('Helvetica');
    console.log(billings);
    
    const row=50;
    let value_header=125;
    // 5. Fill Table Rows
    for (const billing of billings) {
      const items = await this.billingItemRepo.find({where: {billing_id: billing.id}});
      const buyer = await this.userRepo.findById(billing.buyer_id);
      const totalCost = items.reduce((sum, i) => sum + Number(i.total_price || 0), 0);
      const dateValue =`${billing.billing_date}`.slice(0,25); // This is the string from your table


      doc.text(`${billing.id}`, 50,value_header);
      doc.text(buyer.name || '-', 90,value_header);
      doc.text(billing.invoice_number || '-', 200,value_header);
      doc.text(totalCost.toFixed(2), 400,value_header);
      doc.text(dateValue, 500,value_header);
      value_header+=row;
    }

    doc.moveDown(1);
    doc.font('Helvetica-Bold').text('End of Report', {align: 'center'});

    // 6. Finalize PDF
    doc.end();

    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        resolve(fs.readFileSync(pdfPath));
      });
      writeStream.on('error', reject);
    });
  }
}
