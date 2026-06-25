import { forwardRef } from 'react';
import { formatDate } from '@/lib/utils/format';
import { formatCurrency, formatVP } from '@/lib/utils/currency';
import {
  invoiceStatusLabels,
  paymentMethodLabels,
  sortActiveInvoicePayments,
  sumActivePaymentAmount,
  type InvoiceDocumentProps,
} from '@/features/billing/utils/invoiceDocument';
import '@/features/billing/styles/invoice-print.css';

function statusClassName(status: InvoiceDocumentProps['invoice']['status']): string {
  if (status === 'partial') return 'invoice-document__status invoice-document__status--partial';
  if (status === 'paid') return 'invoice-document__status invoice-document__status--paid';
  if (status === 'cancelled') return 'invoice-document__status invoice-document__status--cancelled';
  return 'invoice-document__status';
}

export const InvoiceDocument = forwardRef<HTMLDivElement, InvoiceDocumentProps>(
  function InvoiceDocument({ invoice, businessSettings }, ref) {
    const activePayments = sortActiveInvoicePayments(invoice.payments);
    const paidAmount = sumActivePaymentAmount(invoice.payments);
    const due = Number(invoice.total_amount) - paidAmount;
    const showDueHighlight = due > 0 && invoice.status !== 'cancelled';
    const customer = invoice.customer;
    const showVp = invoice.customer_type === 'coach';
    const showPaymentHistory = invoice.payments.length > 0;

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
            <h2 className="invoice-document__title">INVOICE</h2>
            <p className="invoice-document__meta-row">
              <strong>{invoice.invoice_number}</strong>
            </p>
            <p className="invoice-document__meta-row">Date: {formatDate(invoice.invoice_date)}</p>
            <p className="invoice-document__meta-row">Due: {formatDate(invoice.due_date)}</p>
            <span className={statusClassName(invoice.status)}>
              {invoiceStatusLabels[invoice.status]}
            </span>
          </div>
        </header>

        <section className="invoice-document__section">
          <h3 className="invoice-document__section-title">Bill To</h3>
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
          {invoice.items.length === 0 ? (
            <p>No items on this invoice.</p>
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
                {invoice.items.map((item) => (
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
              {formatCurrency(Number(invoice.subtotal))}
            </span>
          </div>
          <div className="invoice-document__totals-row">
            <span className="invoice-document__totals-label">Tax</span>
            <span className="invoice-document__totals-value">
              {formatCurrency(Number(invoice.tax_amount))}
            </span>
          </div>
          {showVp ? (
            <div className="invoice-document__totals-row">
              <span className="invoice-document__totals-label">Total VP</span>
              <span className="invoice-document__totals-value invoice-document__vp">
                {formatVP(Number(invoice.total_vp))}
              </span>
            </div>
          ) : null}
        </div>

        <div className="invoice-document__payment-summary">
          <h3 className="invoice-document__payment-summary-title">Payment Summary</h3>
          <div className="invoice-document__payment-summary-row invoice-document__payment-summary-row--grand">
            <span>Grand Total</span>
            <strong>{formatCurrency(Number(invoice.total_amount))}</strong>
          </div>
          <div className="invoice-document__payment-summary-row">
            <span>Paid Amount</span>
            <span className="invoice-document__amount-paid">
              {formatCurrency(paidAmount)}
            </span>
          </div>
          <div
            className={`invoice-document__payment-summary-row invoice-document__payment-summary-row--due ${
              showDueHighlight ? 'invoice-document__payment-summary-row--due-highlight' : ''
            }`}
          >
            <span>Due Amount</span>
            <span
              className={
                showDueHighlight
                  ? 'invoice-document__amount-due'
                  : 'invoice-document__amount-due invoice-document__amount-due--clear'
              }
            >
              {formatCurrency(due)}
            </span>
          </div>
        </div>

        {showPaymentHistory && (
          <section className="invoice-document__section">
            <h3 className="invoice-document__section-title">Payment History</h3>
            {activePayments.length > 0 ? (
              <table className="invoice-document__table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Method</th>
                    <th className="text-right">Amount</th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {activePayments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{formatDate(payment.payment_date)}</td>
                      <td>
                        {paymentMethodLabels[
                          payment.payment_method as keyof typeof paymentMethodLabels
                        ] ?? payment.payment_method}
                      </td>
                      <td className="text-right">{formatCurrency(Number(payment.amount))}</td>
                      <td>{payment.reference_num || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="invoice-document__empty-payments">No active payments recorded.</p>
            )}
          </section>
        )}

        {invoice.notes && (
          <section className="invoice-document__section">
            <h3 className="invoice-document__section-title">Notes</h3>
            <p className="invoice-document__notes">{invoice.notes}</p>
          </section>
        )}

        <footer className="invoice-document__footer">Thank you for your business.</footer>
      </div>
    );
  },
);
