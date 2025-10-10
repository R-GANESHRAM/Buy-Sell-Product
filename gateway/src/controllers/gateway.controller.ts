import {post,  response, get, put, requestBody, param, del ,HttpErrors} from '@loopback/rest';
import fetch from 'node-fetch';

export class GatewayController {
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


  // SELLER MODULE
  // Create product (seller only)
  @post('/seller/products')
  async createSellerProduct(@requestBody() productData: any) {
    if (!productData.seller_id)
      throw new Error('seller_id is required');

    productData.created_at = new Date().toISOString();

    const response = await fetch('http://localhost:3001/seller/products', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(productData),
    });

    return response.json();
  }

  // Update product details (seller only)
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

  // List all products by a specific seller
  @get('/seller/products/{id}')
  async listSellerProducts(@param.path.number('id') id: number) {
    const response = await fetch(`http://localhost:3001/seller/products/${id}`);
    return response.json();
  }

  // BUYING MODULE (Cart)
  @post('/buyers/{buyerId}/cart')
  async createCart(@param.path.number('buyerId') buyerId: number) {
    try {
      const response = await fetch(`http://localhost:3002/buyers/${buyerId}/cart`,
        {method: 'POST', headers: {'Content-Type': 'application/json'}},);

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

  
   //Add Item to Cart
  @post('/cart/{cartId}/items')
  async addItemToCart(
    @param.path.number('cartId') cartId: number,
    @requestBody() payload: {product_id: number; quantity: number},
  ) {
    try {
      const response = await fetch(
        `http://localhost:3002/cart/${cartId}/items`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload),
        },
      );

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

 
   //View Cart Items
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

  // BILLING MODULE
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
      const response = await fetch(
       `http://localhost:3003/billing/${billingId}/csv,
        {method: 'GET'},
      `);

      if (!response.ok) {
        const errorText = await response.text();
        throw new HttpErrors.BadRequest(`Billing Service Error: ${errorText}`);
      }

      const csvData = await response.text();

      // Directly return CSV data to client
      return csvData;
    } catch (error) {
      console.error('Error fetching CSV from billing service:', error);
      throw new HttpErrors.InternalServerError('Failed to export CSV via gateway');
    }
  }
}
