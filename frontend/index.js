import {
    initializeBlock,
    loadCSSFromString,
    useBase,
    useRecords,
    TextButton,
    Input,
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
            <p>Create open invoices for every member. Each invoice includes membership dues, building assessment, and marina fees.</p>
            <GenerateInvoices members={members} invoices={invoices} />
        </details>

        <details>
            <summary>Export invoices for Quickbooks</summary>
            <p>Convert all of the draft invoices in Airtable to a CSV file that you can upload to QuickBooks, and then mark those invoices as &quot;sent&quot; in Airtable.</p>
        </details>

        <details>
            <summary>Export membership log</summary>
            <p>Export all current memberships to a CSV file that can be mail-merged into the EYC log.</p>
        </details>
    </div>;
}

function GenerateInvoices({ members, invoices: invoiceTable }) {
    const base = useBase();
    const invoiceItemsTable = base.getTableByName('Invoice items');
    const invoiceField = invoiceTable.getFieldByName('Invoice');
    console.log("Invoice field: " + invoiceField);

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
        <div>
            <p>
                <label>First invoice number:</label>
                {' '}
                <Input
                    value={firstInvoiceNumber}
                    onChange={e => setFirstInvoiceNumber(e.target.value)}
                    placeholder='1000'
                    width="6em"
                    type="number"
                    min={nextInvoiceNumber}
                />
            </p>
            <p>
                <label>Invoice date:</label>
                {' '}
                <Input
                    value={invoiceDate}
                    onChange={e => setInvoiceDate(e.target.value)}
                    placeholder='2024-01-01'
                    width="8em"
                    type="date"
                />
            </p>
            <p>
                <label>Due date:</label>
                {' '}
                <Input
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    placeholder='2024-03-01'
                    width="8em"
                    type="date"
                />
            </p>
            <p>
                <TextButton onClick={() => {
                    createAnnualInvoices(base, members, invoiceTable, Number(firstInvoiceNumber),
                        invoiceDate, dueDate, invoiceItemsTable);
                }}>Create invoices</TextButton>
            </p>
        </div>
    );
}

function chunk(array, chunkSize = 50) {
    return array.reduce((resultArray, item, index) => {
        const chunkIndex = Math.floor(index / chunkSize)
        if (!resultArray[chunkIndex]) {
            resultArray[chunkIndex] = [] // start a new chunk
        }
        resultArray[chunkIndex].push(item)
        return resultArray
    }, [])
}

function hasLineItemWithProductName(itemRecords, productName) {
    return itemRecords.records.some(function (item) {
        const name = item.getCellValueAsString('Product Name');
        return name === productName;
    });
}

async function createAnnualInvoices(base, members, invoiceTable, firstInvoiceNumber, invoiceDate, dueDate,
    invoiceItemsTable) {

    console.log("Creating invoices");
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
    // Split invoices into chunks of 50 records. Airtable has a limit of 50 records
    // per API call.
    const chunks = chunk(newInvoices, 50);
    for (const chunk of chunks) {
        await invoiceTable.createRecordsAsync(chunk);
        await new Promise(resolve => setTimeout(resolve, 200));
    }

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
        console.log("Invoice items: " + existingItems.records.length);

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
    const itemChunks = chunk(newInvoiceItems, 50);
    for (const chunk of itemChunks) {
        await invoiceItemsTable.createRecordsAsync(chunk);
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    allDraftInvoices.unloadData();

    // Let the user know that we are done.
    alert("Created " + newInvoices.length + " invoices and " + newInvoiceItems.length + " invoice line items.");
}

initializeBlock(() => <EYCManagement />);

function downloadCSV(filename, csvContent) {
    var encodedUri = encodeURI(csvContent);
    var link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link); // Required for FF

    link.click();
}