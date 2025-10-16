import {Entity, model, property} from '@loopback/repository';

@model({name:"billing",settings: {strict: true}})
export class Billing extends Entity {
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
  cart_id: number;

  @property({
    type: 'number',
    required: true,
  })
  buyer_id: number;

  @property({
    type: 'number',
    required: true,
  })
  total_amount: number;

  @property({
    type: 'string',
    required: true,
  })
  invoice_number: string;

  @property({
  type: 'date',
  defaultFn: 'now',  
})
billing_date?: string;


  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<Billing>) {
    super(data);
  }
}

export interface BillingRelations {
  // describe navigational properties here
}

export type BillingWithRelations = Billing & BillingRelations;
