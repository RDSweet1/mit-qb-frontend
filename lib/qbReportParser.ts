/**
 * QB Report Parser — Flatten QB's nested Row/ColData structure into renderable arrays
 */

export interface PnlLineItem {
  name: string;
  accountId?: string;
  amount: number;
  children?: PnlLineItem[];
}

export interface PnlSection {
  group: string;
  label: string;
  items: PnlLineItem[];
  total: number;
  isSummaryOnly?: boolean;
}

/**
 * Parse a QB ProfitAndLoss report (summary) into structured sections.
 *
 * QB structure:
 * - Sections have `type: "Section"`, `group` (Income/COGS/Expenses/etc.)
 * - Data rows: ColData[0].value = name, ColData[0].id = QB account ID, ColData[1].value = amount
 * - Nested sections (e.g. Dues→Software Subscriptions): Section within Section
 * - Summary-only sections (GrossProfit, NetIncome): just Summary.ColData
 */
export function parsePnlSummary(report: any): PnlSection[] {
  const rows = report?.Rows?.Row;
  if (!rows || !Array.isArray(rows)) return [];

  const sections: PnlSection[] = [];

  for (const row of rows) {
    if (row.type !== 'Section') continue;

    const group = row.group || '';

    // Summary-only sections (GrossProfit, NetOperatingIncome, NetOtherIncome, NetIncome)
    if (!row.Rows && row.Summary) {
      const colData = row.Summary.ColData;
      sections.push({
        group,
        label: colData[0]?.value || group,
        items: [],
        total: parseFloat(colData[1]?.value) || 0,
        isSummaryOnly: true,
      });
      continue;
    }

    // Regular sections with rows
    const headerLabel = row.Header?.ColData?.[0]?.value || group;
    const items = parseRowItems(row.Rows?.Row || []);
    const summaryAmount = parseFloat(row.Summary?.ColData?.[1]?.value) || 0;

    sections.push({
      group,
      label: headerLabel,
      items,
      total: summaryAmount,
    });
  }

  return sections;
}

function parseRowItems(rows: any[]): PnlLineItem[] {
  const items: PnlLineItem[] = [];

  for (const row of rows) {
    if (row.type === 'Data' && row.ColData) {
      items.push({
        name: row.ColData[0]?.value || '',
        accountId: row.ColData[0]?.id || undefined,
        amount: parseFloat(row.ColData[1]?.value) || 0,
      });
    } else if (row.type === 'Section') {
      // Nested section (e.g. Dues and Subscriptions → Software Subscriptions)
      const name = row.Header?.ColData?.[0]?.value || '';
      const accountId = row.Header?.ColData?.[0]?.id || undefined;
      const children = parseRowItems(row.Rows?.Row || []);
      const total = parseFloat(row.Summary?.ColData?.[1]?.value) || 0;
      items.push({ name, accountId, amount: total, children });
    }
  }

  return items;
}

/**
 * Flatten all expense line items from a P&L report (for overhead sync).
 * Returns items from the Expenses section, with nested sections flattened.
 */
export function flattenExpenseItems(report: any): Array<{
  name: string;
  accountId: string;
  amount: number;
  parentName?: string;
}> {
  const sections = parsePnlSummary(report);
  const expenseSection = sections.find(s => s.group === 'Expenses');
  if (!expenseSection) return [];

  const flat: Array<{ name: string; accountId: string; amount: number; parentName?: string }> = [];

  for (const item of expenseSection.items) {
    if (item.children && item.children.length > 0) {
      // Nested section: add children with parent reference
      for (const child of item.children) {
        flat.push({
          name: child.name,
          accountId: child.accountId || '',
          amount: child.amount,
          parentName: item.name,
        });
      }
      // Also add the parent if it has its own amount beyond the children total
      const childTotal = item.children.reduce((s, c) => s + c.amount, 0);
      if (Math.abs(item.amount - childTotal) > 0.01) {
        flat.push({
          name: item.name,
          accountId: item.accountId || '',
          amount: item.amount - childTotal,
          parentName: undefined,
        });
      }
    } else {
      flat.push({
        name: item.name,
        accountId: item.accountId || '',
        amount: item.amount,
      });
    }
  }

  return flat;
}
