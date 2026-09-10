/**
 * Price seeded into a new project's plan_price and actual_price, and used as the
 * Dashboard's starting unit price. It is only a default: the authoritative price
 * lives on the period_projects junction, per project and period.
 */
export const DEFAULT_UNIT_PRICE = 2300;
