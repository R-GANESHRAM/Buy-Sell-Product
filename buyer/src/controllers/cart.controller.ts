import {repository} from '@loopback/repository';
import {post, get, param, requestBody} from '@loopback/rest';
import {CartRepository, CartitemsRepository, ProductsRepository} from '../repositories';

export class CartController {
  constructor(
    @repository(CartRepository) public cartRepo: CartRepository,
    @repository(CartitemsRepository) public cartItemRepo: CartitemsRepository,
    @repository(ProductsRepository) public productRepo: ProductsRepository,
  ) {}

  // 1. Create Cart for Buyerfkolp;
  @post('/buyers/{buyerId}/cart')
  async createCart(@param.path.number('buyerId') buyerId: number) {
    const existing = await this.cartRepo.findOne({
      where: {buyer_id: buyerId, status: 'OPEN'},
    });
    if (existing) return existing;

    return this.cartRepo.create({buyer_id: buyerId, status: 'OPEN'});
  }

  // 2. Add item to cart
  @post('/cart/{cartId}/items')
  async addItem(
    @param.path.number('cartId') cartId: number,
    @requestBody() payload: {product_id: number; quantity: number},
  ) {
    const product = await this.productRepo.findById(payload.product_id);
    if (product.stock < payload.quantity) {
      throw new Error('Insufficient stock');
    }

    const item = await this.cartItemRepo.create({
      cart_id: cartId,
      product_id: payload.product_id,
      quantity: payload.quantity,
      price_at_add: product.price,
    });

    return item;
  }

  // 3. View Cart
  @get('/cart/{cartId}')
  async viewCart(@param.path.number('cartId') cartId: number) {
    const items = await this.cartItemRepo.find({where: {cart_id: cartId}});
    return {cartId, items};
  }
}
