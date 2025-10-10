import {Entity, model, property} from '@loopback/repository';

@model({name:"Billing_items",settings: {strict: false}})
export class BillingItems extends Entity {
  @property({
    type: 'number',
    id: true,
    generated: true,
  })
  id?: number;

  @property({
    type: 'number',
    required: true,
  })
  billing_id: number;

  @property({
    type: 'number',
    required: true,
  })
  product_id: number;

  @property({
    type: 'number',
    required: true,
  })
  quantity: number;

  @property({
    type: 'number',
    required: true,
  })
  price_each: number;

  @property({
    type: 'number',
    required: true,
  })
  total_price: number;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<BillingItems>) {
    super(data);
  }
}

export interface BillingItemsRelations {
  // describe navigational properties here
}

export type BillingItemsWithRelations = BillingItems & BillingItemsRelations;
