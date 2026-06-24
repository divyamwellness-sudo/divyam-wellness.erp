export type {
  Database,
  Profile,
  BusinessSettings,
  BusinessSettingsUpdate,
  Customer,
  CustomerInsert,
  CustomerUpdate,
  WeightLog,
  WeightLogInsert,
  WeightLogUpdate,
  Product,
  ProductInsert,
  ProductUpdate,
  Gender,
  CustomerGoal,
  CustomerType,
  PricingTier,
  CustomerStatus,
  ProductCategory,
} from './database.types';

export {
  TIERS_BY_CUSTOMER_TYPE,
  PRICE_FIELD_BY_TIER,
  resolveProductPrice,
} from './database.types';
