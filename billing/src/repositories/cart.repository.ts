import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {Cart,Cartitems} from '../models';

export class CartRepository extends DefaultCrudRepository<
  Cart,
  typeof Cart.prototype.id,
  Cartitems
> {
  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
  ) {
    super(Cart, dataSource);
  }
}
