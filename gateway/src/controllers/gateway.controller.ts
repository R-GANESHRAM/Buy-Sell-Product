import {post,Response,response,get,put,requestBody,param,del,HttpErrors,  RestBindings,} from '@loopback/rest';
import {inject} from '@loopback/core';
import fetch from 'node-fetch';

export class GatewayController {
  constructor(
    @inject(RestBindings.Http.RESPONSE) private res: Response,
  ) {}

  // USER MODULE 
  @post('/users')
  async createUser(@requestBody() userData: object) {
    const response = await fetch('http://localhost:3001/users', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(userData),
    });
    return response.json();
  }

  @get('/users')
  async getAllUsers() {
    const response = await fetch('http://localhost:3001/users');
    return response.json();
  }

  @get('/users/{id}')
  async getUser(@param.path.number('id') id: number) {
    const response = await fetch(`http://localhost:3001/users/${id}`);
    return response.json();
  }

  //SELLER MODULE
  @post('/seller/products')
  async createSellerProduct(@requestBody() productData: any) {
    if (!productData.seller_id)
      throw new HttpErrors.BadRequest('seller_id is required');

    productData.created_at = new Date().toISOString();

    const response = await fetch('http://localhost:3001/seller/products', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(productData),
    });

    return response.json();
  }

  @put('/seller/products/{id}')
  async updateSellerProduct(
    @param.path.number('id') id: number,
    @requestBody() payload: object,
  ) {
    const response = await fetch(`http://localhost:3001/seller/products/${id}`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
    });

    return response.json();
  }

  @get('/seller/products/{id}')
  async listSellerProducts(@param.path.number('id') id: number) {
    const response = await fetch(`http://localhost:3001/seller/products/${id}`);
    return response.json();
  }

  @get('/products')
  async listProducts() {
    const response = await fetch('http://localhost:3001/products');
    return response.json();
  }

  // BUYER MODULE 

  @post('/buyers/{buyerId}/cart')
  async createCart(@param.path.number('buyerId') buyerId: number) {
    try {
      const response = await fetch(`http://localhost:3002/buyers/${buyerId}/cart`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
      });

      if (!response.ok) {
        const error = await response.text();
        throw new HttpErrors.BadRequest(`Buying Service Error: ${error}`);
      }

      const data = await response.json();
      return {message: 'Cart created successfully via Gateway', data};
    } catch (error) {
      console.error('Error creating cart:', error);
      throw new HttpErrors.InternalServerError('Failed to create cart via gateway');
    }
  }

  @post('/cart/{cartId}/items')
  async addItemToCart(
    @param.path.number('cartId') cartId: number,
    @requestBody() payload: {product_id: number; quantity: number},
  ) {
    try {
      const response = await fetch(`http://localhost:3002/cart/${cartId}/items`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new HttpErrors.BadRequest(`Buying Service Error: ${error}`);
      }

      const data = await response.json();
      return {message: 'Item added to cart via Gateway', data};
    } catch (error) {
      console.error('Error adding item to cart:', error);
      throw new HttpErrors.InternalServerError('Failed to add item via gateway');
    }
  }

  @get('/cart/{cartId}')
  async viewCart(@param.path.number('cartId') cartId: number) {
    try {
      const response = await fetch(`http://localhost:3002/cart/${cartId}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const error = await response.text();
        throw new HttpErrors.BadRequest(`Buying Service Error: ${error}`);
      }

      const data = await response.json();
      return {message: 'Cart fetched successfully via Gateway', data};
    } catch (error) {
      console.error('Error viewing cart:', error);
      throw new HttpErrors.InternalServerError('Failed to fetch cart via gateway');
    }
  }

  //  BILLING MODULE

  @post('/billing/{cartId}')
  async generateBill(@param.path.number('cartId') cartId: number) {
    try {
      const response = await fetch(`http://localhost:3003/billing/${cartId}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
      });

      const data = await response.json();
      return {message: 'Billing processed via gateway', data};
    } catch (error) {
      console.error('Error forwarding billing request:', error);
      throw new HttpErrors.InternalServerError('Failed to generate billing via gateway');
    }
  }

  @get('/billing/{billingId}/csv')
  @response(200, {
    description: 'CSV file download (via Gateway)',
    content: {'text/csv': {schema: {type: 'string'}}},
  })
  async exportBillingCSV(@param.path.number('billingId') billingId: number) {
    try {
      const response = await fetch(`http://localhost:3003/billing/${billingId}/csv`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new HttpErrors.BadRequest(`Billing Service Error: ${errorText}`);
      }

      const csvData = await response.text();
      return csvData;
    } catch (error) {
      console.error('Error fetching CSV from billing service:', error);
      throw new HttpErrors.InternalServerError('Failed to export CSV via gateway');
    }
  }

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
      const url = `http://localhost:3003/report/pdf?start_time=${start_time}&end_time=${end_time}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new HttpErrors.BadRequest(`Gateway Service Error: ${errorText}`);
      }

      const buffer = await response.arrayBuffer();

      this.res.contentType('application/pdf');
      this.res.send(Buffer.from(buffer));
      return this.res;
    } catch (error) {
      console.error('Error fetching PDF from Gateway:', error);
      throw new HttpErrors.InternalServerError('Failed to fetch PDF via gateway');
    }
    
  }
  
}
