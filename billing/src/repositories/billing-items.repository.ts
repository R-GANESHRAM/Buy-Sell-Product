import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {BillingItems, BillingItemsRelations} from '../models';

export class BillingItemsRepository extends DefaultCrudRepository<
  BillingItems,
  typeof BillingItems.prototype.id,
  BillingItemsRelations
> {
  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
  ) {
    super(BillingItems, dataSource);
  }
}
