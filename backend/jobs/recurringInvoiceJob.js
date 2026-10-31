const db = require("../config/database");

function addBillingCycle(dateString, cycle) {
    const date = new Date(`${String(dateString).slice(0, 10)}T12:00:00Z`);

    switch (cycle) {
        case "DAILY":
            date.setUTCDate(date.getUTCDate() + 1);
            break;
        case "WEEKLY":
            date.setUTCDate(date.getUTCDate() + 7);
            break;
        case "MONTHLY":
            date.setUTCMonth(date.getUTCMonth() + 1);
            break;
        case "YEARLY":
            date.setUTCFullYear(date.getUTCFullYear() + 1);
            break;
        default:
            throw new Error(`Unsupported billing cycle: ${cycle}`);
    }

    return date.toISOString().slice(0, 10);
}

function previousDay(dateString) {
    const date = new Date(`${dateString}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
    const date = new Date(`${dateString}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

async function generateDueInvoices() {
    const connection = await db.getConnection();

    try {
        const [subscriptions] = await connection.execute(
            `SELECT id, subscription_number, customer_id,
                    next_billing_date
             FROM subscriptions
             WHERE status = 'ACTIVE'
               AND next_billing_date IS NOT NULL
               AND next_billing_date <= CURDATE()
             ORDER BY next_billing_date ASC`
        );

        for (const subscription of subscriptions) {
            await connection.beginTransaction();

            try {
                const [lockedRows] = await connection.execute(
                    `SELECT *
                     FROM subscriptions
                     WHERE id = ?
                     FOR UPDATE`,
                    [subscription.id]
                );

                if (
                    lockedRows.length === 0 ||
                    lockedRows[0].status !== "ACTIVE" ||
                    !lockedRows[0].next_billing_date
                ) {
                    await connection.rollback();
                    continue;
                }

                let billingDate = String(
                    lockedRows[0].next_billing_date
                ).slice(0, 10);

                const [lines] = await connection.execute(
                    `SELECT sl.product_id, sl.plan_id,
                            sl.quantity, sl.unit_price,
                            sp.billing_cycle,
                            COALESCE(
                                (SELECT ql.tax_rate
                                 FROM quotation_lines ql
                                 WHERE ql.quotation_id = s.quotation_id
                                   AND ql.plan_id = sl.plan_id
                                   AND ql.product_id = sl.product_id
                                 LIMIT 1),
                                0
                            ) AS tax_rate
                     FROM subscription_lines sl
                     JOIN subscription_plans sp
                       ON sp.id = sl.plan_id
                     JOIN subscriptions s
                       ON s.id = sl.subscription_id
                     WHERE sl.subscription_id = ?`,
                    [subscription.id]
                );

                if (lines.length === 0) {
                    throw new Error("Subscription has no billing lines.");
                }

                // This starter job supports one billing cycle per subscription.
                const cycles = [
                    ...new Set(lines.map(line => line.billing_cycle))
                ];

                if (cycles.length !== 1) {
                    throw new Error(
                        "Mixed billing cycles require separate billing schedules."
                    );
                }

                const cycle = cycles[0];

                // Catch up every missed billing period, rather than skipping it.
                let periodsProcessed = 0;

                while (billingDate <= new Date().toISOString().slice(0, 10)) {
                    if (++periodsProcessed > 120) {
                        throw new Error(
                            "Too many overdue billing periods. Review this subscription."
                        );
                    }

                    const nextDate = addBillingCycle(billingDate, cycle);
                    const periodEnd = previousDay(nextDate);

                    const [existing] = await connection.execute(
                        `SELECT id FROM invoices
                         WHERE subscription_id = ?
                           AND billing_period_start = ?
                           AND billing_period_end = ?`,
                        [
                            subscription.id,
                            billingDate,
                            periodEnd
                        ]
                    );

                    if (existing.length === 0) {
                        let subtotal = 0;
                        let taxAmount = 0;

                        for (const line of lines) {
                            const lineSubtotal = Number(
                                (Number(line.unit_price) *
                                 Number(line.quantity)).toFixed(2)
                            );

                            const lineTax = Number(
                                (lineSubtotal *
                                 Number(line.tax_rate) / 100).toFixed(2)
                            );

                            subtotal += lineSubtotal;
                            taxAmount += lineTax;
                        }

                        subtotal = Number(subtotal.toFixed(2));
                        taxAmount = Number(taxAmount.toFixed(2));

                        const total = Number(
                            (subtotal + taxAmount).toFixed(2)
                        );

                        const invoiceNumber =
                            "INV-" + Date.now() + "-" +
                            Math.floor(Math.random() * 10000);

                        const dueDate = addDays(billingDate, 7);

                        const [invoice] = await connection.execute(
                            `INSERT INTO invoices
                             (invoice_number, subscription_id, customer_id,
                              billing_period_start, billing_period_end,
                              issue_date, due_date, subtotal, tax_amount,
                              discount_amount, total_amount, status)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'DRAFT')`,
                            [
                                invoiceNumber,
                                subscription.id,
                                subscription.customer_id,
                                billingDate,
                                periodEnd,
                                billingDate,
                                dueDate,
                                subtotal,
                                taxAmount,
                                total
                            ]
                        );

                        for (const line of lines) {
                            const lineSubtotal = Number(
                                (Number(line.unit_price) *
                                 Number(line.quantity)).toFixed(2)
                            );

                            const lineTax = Number(
                                (lineSubtotal *
                                 Number(line.tax_rate) / 100).toFixed(2)
                            );

                            await connection.execute(
                                `INSERT INTO invoice_lines
                                 (invoice_id, product_id, plan_id,
                                  description, quantity, unit_price,
                                  tax_rate, line_subtotal, line_tax,
                                  line_total)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [
                                    invoice.insertId,
                                    line.product_id,
                                    line.plan_id,
                                    "Recurring subscription",
                                    line.quantity,
                                    line.unit_price,
                                    line.tax_rate,
                                    lineSubtotal,
                                    lineTax,
                                    Number((lineSubtotal + lineTax).toFixed(2))
                                ]
                            );
                        }
                    }

                    billingDate = nextDate;
                }

                await connection.execute(
                    `UPDATE subscriptions
                     SET next_billing_date = ?
                     WHERE id = ?`,
                    [billingDate, subscription.id]
                );

                await connection.commit();

            } catch (error) {
                await connection.rollback();
                console.error(
                    `Billing failed for subscription ${subscription.id}:`,
                    error.message
                );
            }
        }

        // Update invoices that have passed their due date.
        await connection.execute(
            `UPDATE invoices
             SET status = 'OVERDUE'
             WHERE status = 'CONFIRMED'
               AND due_date < CURDATE()
               AND amount_paid < total_amount`
        );

        console.log("Recurring invoice check completed.");

    } finally {
        connection.release();
    }
}

module.exports = generateDueInvoices;
