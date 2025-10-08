import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {Cartitems, CartitemsRelations} from '../models';

export class CartitemsRepository extends DefaultCrudRepository<
  Cartitems,
  typeof Cartitems.prototype.id,
  CartitemsRelations
> {
  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
  ) {
    super(Cartitems, dataSource);
  }
}
