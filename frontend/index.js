import {
    initializeBlock,
    loadCSSFromString,
    useBase,
    useRecords,
    Box,
    Button,
    FormField,
    TextButton,
    Input,
    ConfirmationDialog,
} from '@airtable/blocks/ui';
import {
    aggregators,
} from '@airtable/blocks/models';
import React, {
    useState,
} from 'react';

function EYCManagement() {
    const base = useBase();
    const membership = base.getTableByName('Membership');
    const invoices = base.getTableByName('Invoices');
    const members = useRecords(membership);
    const css = `
        #eyc-management {
            padding: 10px;
        }
        #eyc-management h1 {
            font-size: 1.5em;
            margin-bottom: 1em;
            margin-top: 0;
        }
        #eyc-management details {
            margin-bottom: 1em;
            margin-left: 16px;
        }
        #eyc-management summary {
            font-size: 1.2em;
            font-weight: bold;
            margin-bottom: 0.5em;
            margin-left: -16px;
        }
        #eyc-management p {
            margin-bottom: 0.5em;
        }
    `
    loadCSSFromString(css);
    return <div id="eyc-management">
        <h1>EYC management</h1>

        <details>
            <summary>Create annual membership invoices</summary>
            <p>Create draft invoices for every member. Each invoice includes membership dues, building assessment, and marina fees.</p>
            <p>Note that these invoice items will be <i>added</i> to any existing invoices, so delete the current invoices first if you want to start from scratch.</p>
            <GenerateInvoices members={members} invoices={invoices} />
        </details>

        <details>
            <summary>Export invoices for Quickbooks</summary>
            <p>Convert all of the draft invoices in Airtable to a CSV file that you can upload to QuickBooks, and then mark those invoices as &quot;sent&quot; in Airtable.</p>
            <ExportInvoices />
        </details>

        <details>
            <summary>Delete all invoices</summary>
            <p>Delete all invoices in the database. The draft invoices in Airtable are only a staging area for transfer to QuickBooks, so once they have been exported they can be deleted.</p>
            <DeleteAllInvoices />
        </details>

        <details>
            <summary>Export membership log</summary>
            <p>Export all current memberships to a CSV file that can be mail-merged into the EYC log.</p>
        </details>
    </div>;
}

function ExportInvoices() {
    const base = useBase();
    const itemsTable = base.getTableByName('Invoice items');

    return (
        <div>
            <Button icon="file"
                onClick={() => {
                    exportInvoices(base, itemsTable);
                }}>Export invoices</Button>
        </div>
    );
}

async function exportInvoices(base, itemsTable) {


    const draftItemsView = itemsTable.getView('Draft items');
    const draftItemsQuery = await draftItemsView.selectRecordsAsync({ fields: ['Invoice', 'Member Name', 'Unit price', 'Product Name', 'Description', 'Quantity', 'Invoice Date', 'Due Date', 'Service Date', 'Amount'] });
    await draftItemsQuery.loadDataAsync();


    var csv = "Invoice #,Member Name,Unit price,Product Name,Description,Quantity,Invoice Date,Due Date,Service Date,Amount\r\n";
    for (const record of draftItemsQuery.records) {
        csv += record.getCellValueAsString('Invoice') + ",";
        csv += record.getCellValueAsString('Member Name') + ",";
        csv += record.getCellValue('Unit price') + ",";
        csv += record.getCellValueAsString('Product Name') + ",";
        csv += record.getCellValueAsString('Description') + ",";
        csv += record.getCellValue('Quantity') + ",";
        csv += record.getCellValueAsString('Invoice Date') + ",";
        csv += record.getCellValueAsString('Due Date') + ",";
        csv += record.getCellValueAsString('Service Date') + ",";
        csv += record.getCellValue('Amount');
        csv += "\r\n";
    }
    draftItemsQuery.unloadData();

    downloadCSV("invoices.csv", csv);

    // Mark all of the invoices as sent.
    const invoicesTable = base.getTableByName('Invoices');
    const draftInvoicesView = invoicesTable.getView('Draft invoices');
    const draftInvoicesQuery = await draftInvoicesView.selectRecordsAsync({ fields: ['Invoice', 'Membership of draft invoice'] });
    await draftInvoicesQuery.loadDataAsync();
    var invoiceUpdates = [];
    for (const record of draftInvoicesQuery.records) {
        invoiceUpdates.push({
            id: record.id,
            fields: {
                'Membership of draft invoice': [],
            }
        });
    }
    await bulkUpdate(invoicesTable, invoiceUpdates);
}

const BATCH_SIZE = 50;

async function bulkUpdate(table, records) {
    let i = 0;
    while (i < records.length) {
        const recordBatch = records.slice(i, i + BATCH_SIZE);
        // awaiting the delete means that next batch won't be deleted until the current
        // batch has been fully deleted, keeping you under the rate limit
        await table.updateRecordsAsync(recordBatch);
        i += BATCH_SIZE;
    }
}

async function bulkCreate(table, records) {
    let i = 0;
    while (i < records.length) {
        const recordBatch = records.slice(i, i + BATCH_SIZE);
        await table.createRecordsAsync(recordBatch);
        i += BATCH_SIZE;
    }
}

async function bulkDelete(table, records) {
    let i = 0;
    while (i < records.length) {
        const recordBatch = records.slice(i, i + BATCH_SIZE);
        // awaiting the delete means that next batch won't be deleted until the current
        // batch has been fully deleted, keeping you under the rate limit
        await table.deleteRecordsAsync(recordBatch);
        i += BATCH_SIZE;
    }
}

function DeleteAllInvoices() {
    const base = useBase();
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    return (
        <React.Fragment>
            <Button icon="trash" variant='danger'
                onClick={() => {
                    setIsDialogOpen(true);
                }}>Delete all invoices</Button>

            {isDialogOpen && (
                <ConfirmationDialog
                    isConfirmActionDangerous={true}
                    title="Delete all invoices"
                    body="Are you sure you want to delete all draft invoices? This cannot be undone."
                    confirmButtonText="Delete all invoices"
                    onConfirm={() => {
                        setIsDialogOpen(false);
                        deleteAllInvoices(base);
                    }}
                    onCancel={() => setIsDialogOpen(false)} />
            )}
        </React.Fragment>
    );
}

async function deleteAllRecordsInTable(table) {
    const records = await table.selectRecordsAsync();
    await bulkDelete(table, records.records);
    records.unloadData();
}

async function deleteAllInvoices(base) {
    const invoiceTable = base.getTableByName('Invoices');
    const invoiceItemsTable = base.getTableByName('Invoice items');
    await deleteAllRecordsInTable(invoiceItemsTable);
    await deleteAllRecordsInTable(invoiceTable);
}

function GenerateInvoices({ members, invoices: invoiceTable }) {
    const base = useBase();
    const invoiceItemsTable = base.getTableByName('Invoice items');
    const invoiceField = invoiceTable.getFieldByName('Invoice');

    // Find the highest invoice number in all existing invoices (not just the ones
    // for the passed-in members).
    const existingInvoices = useRecords(invoiceTable);
    var nextInvoiceNumber = aggregators.max.aggregate(existingInvoices, invoiceField);
    if (nextInvoiceNumber) {
        nextInvoiceNumber = nextInvoiceNumber + 1;
    } else {
        nextInvoiceNumber = 2000;
    }

    const [firstInvoiceNumber, setFirstInvoiceNumber] = useState(nextInvoiceNumber.toString());
    const [invoiceDate, setInvoiceDate] = useState("2024-01-01");
    const [dueDate, setDueDate] = useState("2024-03-01");

    // Return a React component that displays a numeric text input field
    // for the first invoice number, and a button to generate invoices.
    return (
        <Box padding={2} border="1px solid #AAA" width="fit-content">
            <FormField label="First invoice number">
                <Input
                    value={firstInvoiceNumber}
                    onChange={e => setFirstInvoiceNumber(e.target.value)}
                    placeholder='1000'
                    width="6em"
                    type="number"
                    min={nextInvoiceNumber}
                />
            </FormField>
            <FormField label="Invoice date">
                <Input
                    value={invoiceDate}
                    onChange={e => setInvoiceDate(e.target.value)}
                    placeholder='2024-01-01'
                    width="8em"
                    type="date"
                />
            </FormField>
            <FormField label="Due date">
                <Input
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    placeholder='2024-03-01'
                    width="8em"
                    type="date"
                />
            </FormField>
            <p>
                <Button icon="plus"
                    onClick={() => {
                        createAnnualInvoices(base, members, invoiceTable, Number(firstInvoiceNumber),
                            invoiceDate, dueDate, invoiceItemsTable);
                    }}>Create invoices</Button>
            </p>
        </Box>
    );
}

function hasLineItemWithProductName(itemRecords, productName) {
    return itemRecords.records.some(function (item) {
        const name = item.getCellValueAsString('Product Name');
        return name === productName;
    });
}

async function createAnnualInvoices(base, members, invoiceTable, firstInvoiceNumber, invoiceDate, dueDate,
    invoiceItemsTable) {

    // If the firstInvoiceNumber is negative infinity, then the user didn't enter a number.
    if (!isFinite(firstInvoiceNumber)) {
        alert("Please enter a number for the first invoice number.");
        return;
    }

    // Calculate the service date, which is the first day of the same year as the dueDate.
    const serviceDate = dueDate.substring(0, 4) + "-01-01";

    var nextInvoiceNumber = firstInvoiceNumber;
    const newInvoices = members.flatMap(function (member) {
        // If the member already has a draft invoice, don't create another one.
        const draftInvoice = member.getCellValue('Draft invoice');
        if (draftInvoice) {
            return [];
        }

        // If the member doesn't owe annual dues or a building assessment, don't
        // create an invoice.
        const dues = member.getCellValue('Annual dues');
        const assessment = member.getCellValue('Building assessment');
        if ((dues === 0 || dues === null) && (assessment === 0 || assessment === null)) {
            return [];
        }

        const invoiceNumber = nextInvoiceNumber;
        nextInvoiceNumber++;
        return {
            fields: {
                "Invoice": invoiceNumber,
                'Invoice Date': invoiceDate,
                'Due Date': dueDate,
                'Membership': [{ 'id': member.id }],
                "Membership of draft invoice": [{ 'id': member.id }],
            }
        };
    });

    // console.log(JSON.stringify(newInvoices));
    await bulkCreate(invoiceTable, newInvoices);

    // Load all of the draft invoices so we can examine their existing invoice items.
    const draftInvoicesView = invoiceTable.getView('Draft invoices');
    const allDraftInvoices = await draftInvoicesView.selectRecordsAsync({ fields: ['Invoice', 'Invoice items'] });
    await allDraftInvoices.loadDataAsync();

    // Now we know that all members who owe dues have a draft invoice. Now go through
    // the member's draft invoices and add the dues and assessment to the invoice.

    var newInvoiceItems = [];

    for (const member of members) {
        const draftInvoice = member.getCellValue('Draft invoice');
        if (draftInvoice === null || draftInvoice.length === 0) {
            continue;
        }
        const invoice = draftInvoice[0];
        var memberType = member.getCellValue('Member Type');
        if (memberType === null || memberType.length === 0) {
            continue;
        }
        memberType = memberType[0];
        const dues = member.getCellValue('Annual dues');

        // Get the existing invoice items for this invoice.
        const invoiceRecord = allDraftInvoices.getRecordByIdIfExists(invoice.id);
        const existingItems = invoiceRecord.selectLinkedRecordsFromCell('Invoice items', { fields: ['Product Name'] });
        await existingItems.loadDataAsync();
        // console.log("Invoice items: " + existingItems.records.length);

        if (dues && dues.length > 0 && !hasLineItemWithProductName(existingItems, memberType.name)) {
            // Before adding the dues to the invoice, check to see if the draft invoice
            // already has an invoice item for dues. If so, don't add another one.
            newInvoiceItems.push({
                fields: {
                    'Invoice': [{ 'id': invoice.id }],
                    'Product Name': memberType.name,
                    'Description': memberType.name + ' Dues',
                    'Unit price': dues[0].value,
                    'Service Date': serviceDate,
                    'Quantity': 1,
                }
            });
        }
        const assessment = member.getCellValue('Building assessment');
        if (assessment && assessment.length > 0 && !hasLineItemWithProductName(existingItems, 'Building Assessment')) {
            newInvoiceItems.push({
                fields: {
                    'Invoice': [{ 'id': invoice.id }],
                    'Product Name': 'Building Assessment',
                    'Description': 'Building Assessment',
                    'Unit price': assessment[0].value,
                    'Service Date': serviceDate,
                    'Quantity': 1,
                }
            });
        }

        existingItems.unloadData();
    }

    // Split invoice items into chunks of 50 records. Airtable has a limit of 50 records
    // per API call.
    await bulkCreate(invoiceItemsTable, newInvoiceItems);
    // const itemChunks = chunk(newInvoiceItems, 50);
    // for (const chunk of itemChunks) {
    //     await invoiceItemsTable.createRecordsAsync(chunk);
    //     await new Promise(resolve => setTimeout(resolve, 200));
    // }

    allDraftInvoices.unloadData();

    // Let the user know that we are done.
    alert("Created " + newInvoices.length + " invoices and " + newInvoiceItems.length + " invoice line items.");
}

initializeBlock(() => <EYCManagement />);

function downloadCSV(filename, csvContent) {
    var encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    var link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link); // Required for Firefox

    link.click();
}
