import {repository} from '@loopback/repository';
import {post, get, param, response} from '@loopback/rest';
import {CartRepository, CartitemsRepository, ProductsRepository, BillingRepository, BillingItemsRepository} from '../repositories';
import {Billing, BillingItems} from '../models';
import * as fs from 'fs';
import * as path from 'path';

export class BillingController {
  constructor(
    @repository(CartRepository) private cartRepo: CartRepository,
    @repository(CartitemsRepository) private cartItemRepo: CartitemsRepository,
    @repository(ProductsRepository) private productRepo: ProductsRepository,
    @repository(BillingRepository) private billingRepo: BillingRepository,
    @repository(BillingItemsRepository) private billingItemRepo: BillingItemsRepository,
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
}
