import {repository} from '@loopback/repository';
import {post, put, get, param, requestBody} from '@loopback/rest';
import {Products} from '../models';
import {ProductsRepository} from '../repositories';

export class ProductController {
  constructor(
    @repository(ProductsRepository) public productRepo: ProductsRepository,
  ) {}

  // Add new product
  @post('/seller/products')
  async createProduct(@requestBody() productData: Partial<Products>) {
    if (!productData.seller_id) throw new Error('seller_id is required');
    productData.created_at = new Date().toISOString();
    const product = await this.productRepo.create(productData as Products);
    return product;
  }

  // Update product (price, stock, description)
  @put('/seller/products/{id}')
  async updateProduct(
    @param.path.number('id') id: number,
    @requestBody() payload: Partial<Products>,
  ) {
    await this.productRepo.updateById(id, payload as Products);
    return this.productRepo.findById(id);
  }

  // List all products by seller
  @get('/seller/products/{sellerId}')
  async listBySeller(@param.path.number('sellerId') sellerId: number) {
    return this.productRepo.find({where: {seller_id: sellerId}});
  }
}