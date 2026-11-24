import * as XLSX from 'xlsx';

export const PARTNER_TEMPLATE_COLUMNS = [
  'Full Name',
  'Email Address',
  'Phone Number',
  'Gender',
  'State',
  'Organisation',
  'Maximum Caseload',
  'Notes',
] as const;

export const PARTNER_TEMPLATE_FILENAME = 'CII_Accountability_Partner_Import_Template.xlsx';

const SAMPLE_PARTNER_EMAIL = 'sample.partner@cii-example.org';

export interface ParsedPartnerRow {
  rowNumber: number;
  fullName: string;
  email: string;
  phone: string;
  gender: string;
  state: string;
  organisation: string;
  maxCaseloadRaw: string;
  maxCaseload: number;
  notes: string;
  status: 'valid' | 'invalid' | 'duplicate' | 'existing';
  errors: string[];
}

export interface PartnerImportAnalysis {
  missingColumns: string[];
  unrecognizedColumns: string[];
  totalRowsFound: number;
  sampleRowsSkipped: number;
  validRows: ParsedPartnerRow[];
  invalidRows: ParsedPartnerRow[];
  duplicateRows: ParsedPartnerRow[];
  existingRows: ParsedPartnerRow[];
  allRows: ParsedPartnerRow[];
}

export function downloadPartnerImportTemplate(): void {
  const wb = XLSX.utils.book_new();

  const partnersSheetData = [
    [...PARTNER_TEMPLATE_COLUMNS],
    [
      'SAMPLE — Dr. Chinwe Okafor (Remove or leave as sample; automatically skipped on import)',
      SAMPLE_PARTNER_EMAIL,
      '+2348031234567',
      'Female',
      'Lagos',
      'Corper Impact Initiative (CII)',
      10,
      'Sample mentor record — replace with real Accountability Partner details below.',
    ],
  ];

  const wsPartners = XLSX.utils.aoa_to_sheet(partnersSheetData);
  wsPartners['!cols'] = [
    { wch: 36 },
    { wch: 30 },
    { wch: 18 },
    { wch: 12 },
    { wch: 16 },
    { wch: 30 },
    { wch: 18 },
    { wch: 42 },
  ];
  XLSX.utils.book_append_sheet(wb, wsPartners, 'Partners');

  const instructionsData = [
    ['CII ACCOUNTABILITY TRACKER — ACCOUNTABILITY PARTNER BULK IMPORT INSTRUCTIONS'],
    [''],
    ['1. OVERVIEW'],
    [
      'Use the "Partners" worksheet to bulk-import Accountability Partners into the CII Accountability Tracker.',
    ],
    [
      'Note: The sample row (sample.partner@cii-example.org) is provided as a formatting reference and is automatically ignored during import.',
    ],
    [''],
    ['2. COLUMN SPECIFICATIONS'],
    ['Column Name', 'Requirement', 'Validation & Formatting Rules'],
    ['Full Name', 'REQUIRED', 'Full legal or professional name of the Accountability Partner (2–100 characters).'],
    [
      'Email Address',
      'REQUIRED',
      'Valid, unique email address (e.g., partner@domain.org). Must not be duplicated in the sheet or already registered in the system.',
    ],
    [
      'Phone Number',
      'REQUIRED',
      'Valid telephone number containing 7–15 digits. International format (+2348031234567) or local format (08031234567) is accepted.',
    ],
    ['Gender', 'OPTIONAL', 'Optional (e.g., Female, Male, Prefer not to say).'],
    ['State', 'OPTIONAL', 'Optional state of residence or deployment (e.g., Lagos, FCT Abuja, Rivers).'],
    ['Organisation', 'OPTIONAL', 'Optional employer, institution, or CII unit (max 120 characters).'],
    [
      'Maximum Caseload',
      'REQUIRED',
      'Must be a positive whole number between 1 and 200 indicating the maximum number of Corps Members this partner can mentor.',
    ],
    ['Notes', 'OPTIONAL', 'Optional administrative notes or specialization tags (max 500 characters).'],
    [''],
    ['3. ACCOUNT ACTIVATION & SECURITY'],
    [
      'Importing a valid row creates an email-bound Accountability Partner invitation in Firestore. No plaintext passwords are stored.',
    ],
    [
      'Each imported partner activates their account via their unique activation link or invitation code and is routed directly to /partner.',
    ],
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  wsInstructions['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 84 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  XLSX.writeFile(wb, PARTNER_TEMPLATE_FILENAME);
}

const HEADER_ALIASES: Record<string, (typeof PARTNER_TEMPLATE_COLUMNS)[number]> = {
  'full name': 'Full Name',
  fullname: 'Full Name',
  name: 'Full Name',
  'email address': 'Email Address',
  email: 'Email Address',
  'phone number': 'Phone Number',
  phone: 'Phone Number',
  telephone: 'Phone Number',
  mobile: 'Phone Number',
  gender: 'Gender',
  state: 'State',
  organisation: 'Organisation',
  organization: 'Organisation',
  'maximum caseload': 'Maximum Caseload',
  'max caseload': 'Maximum Caseload',
  maxcaseload: 'Maximum Caseload',
  caseload: 'Maximum Caseload',
  notes: 'Notes',
  note: 'Notes',
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-().]/g, '');
  return /^\+?[0-9]{7,15}$/.test(cleaned);
}

function isSampleRow(fullName: string, email: string): boolean {
  const lowerEmail = email.trim().toLowerCase();
  const lowerName = fullName.trim().toLowerCase();
  return (
    lowerEmail === SAMPLE_PARTNER_EMAIL ||
    lowerName.startsWith('sample —') ||
    lowerName.startsWith('sample -')
  );
}

export async function parseAndValidatePartnerSpreadsheet(
  file: File,
  existingEmails: Set<string>
): Promise<PartnerImportAnalysis> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const sheetName =
    workbook.SheetNames.find((n) => n.toLowerCase() === 'partners') ||
    workbook.SheetNames[0];

  if (!sheetName) {
    return {
      missingColumns: [...PARTNER_TEMPLATE_COLUMNS],
      unrecognizedColumns: [],
      totalRowsFound: 0,
      sampleRowsSkipped: 0,
      validRows: [],
      invalidRows: [],
      duplicateRows: [],
      existingRows: [],
      allRows: [],
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<Array<string | number | null | undefined>>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (matrix.length === 0) {
    return {
      missingColumns: ['Full Name', 'Email Address', 'Phone Number', 'Maximum Caseload'],
      unrecognizedColumns: [],
      totalRowsFound: 0,
      sampleRowsSkipped: 0,
      validRows: [],
      invalidRows: [],
      duplicateRows: [],
      existingRows: [],
      allRows: [],
    };
  }

  const rawHeaders = (matrix[0] || []).map((cell) => String(cell ?? '').trim());
  const columnIndexMap: Partial<Record<(typeof PARTNER_TEMPLATE_COLUMNS)[number], number>> = {};
  const unrecognizedColumns: string[] = [];

  rawHeaders.forEach((header, idx) => {
    if (!header) return;
    const normalized = header.toLowerCase().replace(/\s+/g, ' ');
    const mapped = HEADER_ALIASES[normalized];
    if (mapped) {
      if (columnIndexMap[mapped] === undefined) {
        columnIndexMap[mapped] = idx;
      }
    } else {
      unrecognizedColumns.push(header);
    }
  });

  const requiredColumns: Array<(typeof PARTNER_TEMPLATE_COLUMNS)[number]> = [
    'Full Name',
    'Email Address',
    'Phone Number',
    'Maximum Caseload',
  ];

  const missingColumns = requiredColumns.filter((col) => columnIndexMap[col] === undefined);

  const seenEmailsInSheet = new Set<string>();
  const validRows: ParsedPartnerRow[] = [];
  const invalidRows: ParsedPartnerRow[] = [];
  const duplicateRows: ParsedPartnerRow[] = [];
  const existingRows: ParsedPartnerRow[] = [];
  const allRows: ParsedPartnerRow[] = [];
  let sampleRowsSkipped = 0;

  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i] || [];
    const getCell = (col: (typeof PARTNER_TEMPLATE_COLUMNS)[number]): string => {
      const idx = columnIndexMap[col];
      if (idx === undefined) return '';
      return String(row[idx] ?? '').trim();
    };

    const fullName = getCell('Full Name');
    const email = getCell('Email Address').toLowerCase();
    const phone = getCell('Phone Number');
    const gender = getCell('Gender');
    const state = getCell('State');
    const organisation = getCell('Organisation');
    const maxCaseloadRaw = getCell('Maximum Caseload');
    const notes = getCell('Notes');

    // Skip completely empty rows
    if (
      !fullName &&
      !email &&
      !phone &&
      !gender &&
      !state &&
      !organisation &&
      !maxCaseloadRaw &&
      !notes
    ) {
      continue;
    }

    // Automatically ignore the template sample row
    if (isSampleRow(fullName, email)) {
      sampleRowsSkipped += 1;
      continue;
    }

    const errors: string[] = [];
    if (missingColumns.length > 0) {
      errors.push(`Missing required column(s): ${missingColumns.join(', ')}`);
    }

    if (!fullName) {
      errors.push('Full Name is required.');
    } else if (fullName.length < 2 || fullName.length > 100) {
      errors.push('Full Name must be between 2 and 100 characters.');
    }

    if (!email) {
      errors.push('Email Address is required.');
    } else if (!isValidEmail(email)) {
      errors.push('Invalid Email Address format.');
    }

    if (!phone) {
      errors.push('Phone Number is required.');
    } else if (!isValidPhone(phone)) {
      errors.push('Invalid Phone Number (use 7–15 digits, e.g., +2348031234567 or 08031234567).');
    }

    const parsedCaseload = Number(maxCaseloadRaw);
    if (!maxCaseloadRaw) {
      errors.push('Maximum Caseload is required.');
    } else if (
      !Number.isInteger(parsedCaseload) ||
      parsedCaseload <= 0 ||
      parsedCaseload > 200
    ) {
      errors.push('Maximum Caseload must be a positive whole number between 1 and 200.');
    }

    let status: ParsedPartnerRow['status'] = 'valid';

    if (errors.length > 0) {
      status = 'invalid';
    } else if (seenEmailsInSheet.has(email)) {
      status = 'duplicate';
      errors.push('Duplicate Email Address inside this uploaded spreadsheet.');
    } else if (existingEmails.has(email)) {
      status = 'existing';
      errors.push('Email Address is already registered or invited in the system.');
    }

    if (email && isValidEmail(email)) {
      seenEmailsInSheet.add(email);
    }

    const parsedRow: ParsedPartnerRow = {
      rowNumber: i + 1,
      fullName,
      email,
      phone,
      gender,
      state,
      organisation,
      maxCaseloadRaw,
      maxCaseload: Number.isInteger(parsedCaseload) && parsedCaseload > 0 ? parsedCaseload : 10,
      notes,
      status,
      errors,
    };

    allRows.push(parsedRow);
    if (status === 'valid') validRows.push(parsedRow);
    else if (status === 'duplicate') duplicateRows.push(parsedRow);
    else if (status === 'existing') existingRows.push(parsedRow);
    else invalidRows.push(parsedRow);
  }

  return {
    missingColumns,
    unrecognizedColumns,
    totalRowsFound: allRows.length,
    sampleRowsSkipped,
    validRows,
    invalidRows,
    duplicateRows,
    existingRows,
    allRows,
  };
}

export function downloadRejectedPartnerRowsReport(rejectedRows: ParsedPartnerRow[]): void {
  const wb = XLSX.utils.book_new();
  const data = [
    [
      'Spreadsheet Row #',
      'Rejection Category',
      'Full Name',
      'Email Address',
      'Phone Number',
      'Gender',
      'State',
      'Organisation',
      'Maximum Caseload',
      'Notes',
      'Rejection Reason(s)',
    ],
    ...rejectedRows.map((r) => [
      r.rowNumber,
      r.status.toUpperCase(),
      r.fullName,
      r.email,
      r.phone,
      r.gender,
      r.state,
      r.organisation,
      r.maxCaseloadRaw,
      r.notes,
      r.errors.join(' | '),
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 16 },
    { wch: 18 },
    { wch: 26 },
    { wch: 28 },
    { wch: 18 },
    { wch: 12 },
    { wch: 16 },
    { wch: 26 },
    { wch: 18 },
    { wch: 24 },
    { wch: 56 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Rejected_Rows');
  const tag = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `CII_Rejected_Partner_Import_Rows_${tag}.xlsx`);
}
