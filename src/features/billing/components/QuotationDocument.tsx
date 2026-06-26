import { forwardRef } from 'react';
import { formatDate } from '@/lib/utils/format';
import { formatCurrency, formatVP } from '@/lib/utils/currency';
import {
  quotationStatusLabels,
  type QuotationDocumentProps,
} from '@/features/billing/utils/quotationDocument';
import '@/features/billing/styles/invoice-print.css';

function statusClassName(status: QuotationDocumentProps['quotation']['status']): string {
  switch (status) {
    case 'sent':
      return 'invoice-document__status invoice-document__status--partial';
    case 'accepted':
      return 'invoice-document__status invoice-document__status--paid';
    case 'rejected':
    case 'expired':
      return 'invoice-document__status invoice-document__status--cancelled';
    case 'converted':
      return 'invoice-document__status invoice-document__status--paid';
    default:
      return 'invoice-document__status';
  }
}

/**
 * Print/PDF document for a quotation. Reuses the invoice print stylesheet
 * (class names prefixed `invoice-document__*`) so the visual language stays
 * consistent across business documents.
 *
 * Differences from InvoiceDocument:
 *   * Title is QUOTATION (not INVOICE).
 *   * Shows Valid Until instead of Due Date.
 *   * Hides customer_type and pricing_tier (internal ERP fields).
 *   * Hides payment summary + payment history (quotations are not paid).
 *   * VP column appears only for Coach customers (VP rules).
 */
export const QuotationDocument = forwardRef<HTMLDivElement, QuotationDocumentProps>(
  function QuotationDocument({ quotation, businessSettings }, ref) {
    const customer = quotation.customer;
    const showVp = quotation.customer_type === 'coach';

    return (
      <div ref={ref} className="invoice-document">
        <header className="invoice-document__header">
          <div className="invoice-document__brand">
            {businessSettings.logo_url ? (
              <img
                src={businessSettings.logo_url}
                alt={`${businessSettings.business_name} logo`}
                className="invoice-document__logo"
              />
            ) : (
              <div className="invoice-document__logo-placeholder" aria-label="Business logo placeholder">
                Logo
              </div>
            )}
            <div>
              <h1 className="invoice-document__business-name">{businessSettings.business_name}</h1>
              {businessSettings.address && (
                <p className="invoice-document__business-meta">{businessSettings.address}</p>
              )}
              {businessSettings.phone && (
                <p className="invoice-document__business-meta">Phone: {businessSettings.phone}</p>
              )}
              {businessSettings.whatsapp_number && (
                <p className="invoice-document__business-meta">
                  WhatsApp: {businessSettings.whatsapp_number}
                </p>
              )}
              {businessSettings.email && (
                <p className="invoice-document__business-meta">Email: {businessSettings.email}</p>
              )}
              {businessSettings.gstin && (
                <p className="invoice-document__business-meta">GSTIN: {businessSettings.gstin}</p>
              )}
            </div>
          </div>

          <div className="invoice-document__title-block">
            <h2 className="invoice-document__title">QUOTATION</h2>
            <p className="invoice-document__meta-row">
              <strong>{quotation.quotation_number}</strong>
            </p>
            <p className="invoice-document__meta-row">
              Date: {formatDate(quotation.quotation_date)}
            </p>
            <p className="invoice-document__meta-row">
              Valid Until: {formatDate(quotation.valid_until)}
            </p>
            <span className={statusClassName(quotation.status)}>
              {quotationStatusLabels[quotation.status]}
            </span>
          </div>
        </header>

        <section className="invoice-document__section">
          <h3 className="invoice-document__section-title">Quoted To</h3>
          <div className="invoice-document__grid">
            <div>
              <span className="invoice-document__field-label">Customer Name</span>
              <p className="invoice-document__field-value">{customer?.name ?? '—'}</p>
            </div>
            <div>
              <span className="invoice-document__field-label">Phone Number</span>
              <p className="invoice-document__field-value">{customer?.phone ?? '—'}</p>
            </div>
          </div>
        </section>

        <section className="invoice-document__section">
          <h3 className="invoice-document__section-title">Items</h3>
          {quotation.items.length === 0 ? (
            <p>No items on this quotation.</p>
          ) : (
            <table className="invoice-document__table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Unit Price</th>
                  <th className="text-right">Line Total</th>
                  {showVp ? <th className="text-right">VP</th> : null}
                </tr>
              </thead>
              <tbody>
                {quotation.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div>{item.product_name}</div>
                      <div className="invoice-document__product-sku">{item.product_sku}</div>
                    </td>
                    <td className="text-right">{item.quantity}</td>
                    <td className="text-right">{formatCurrency(Number(item.unit_price))}</td>
                    <td className="text-right">{formatCurrency(Number(item.line_total))}</td>
                    {showVp ? (
                      <td className="text-right invoice-document__vp">
                        {formatVP(Number(item.line_vp))}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <div className="invoice-document__totals">
          <div className="invoice-document__totals-row">
            <span className="invoice-document__totals-label">Subtotal</span>
            <span className="invoice-document__totals-value">
              {formatCurrency(Number(quotation.subtotal))}
            </span>
          </div>
          <div className="invoice-document__totals-row">
            <span className="invoice-document__totals-label">Tax</span>
            <span className="invoice-document__totals-value">
              {formatCurrency(Number(quotation.tax_amount))}
            </span>
          </div>
          {showVp ? (
            <div className="invoice-document__totals-row">
              <span className="invoice-document__totals-label">Total VP</span>
              <span className="invoice-document__totals-value invoice-document__vp">
                {formatVP(Number(quotation.total_vp))}
              </span>
            </div>
          ) : null}
        </div>

        <div className="invoice-document__payment-summary">
          <h3 className="invoice-document__payment-summary-title">Quotation Total</h3>
          <div className="invoice-document__payment-summary-row invoice-document__payment-summary-row--grand">
            <span>Total Amount</span>
            <strong>{formatCurrency(Number(quotation.total_amount))}</strong>
          </div>
        </div>

        {quotation.terms && (
          <section className="invoice-document__section">
            <h3 className="invoice-document__section-title">Terms &amp; Conditions</h3>
            <p className="invoice-document__notes">{quotation.terms}</p>
          </section>
        )}

        {quotation.notes && (
          <section className="invoice-document__section">
            <h3 className="invoice-document__section-title">Notes</h3>
            <p className="invoice-document__notes">{quotation.notes}</p>
          </section>
        )}

        <footer className="invoice-document__footer">
          This quotation is valid until {formatDate(quotation.valid_until)}. Prices are subject to
          change after this date.
        </footer>
      </div>
    );
  },
);
