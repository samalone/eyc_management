import {
    initializeBlock,
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
    return <div>
        <h1>EYC Management</h1>
        <h2>Create annual membership invoices</h2>
        <p>Create open invoices for every member. Each invoice includes membership dues, building assessment, and
            marina fees.</p>
        <GenerateInvoices members={members} invoices={invoices} />
    </div>;
}

function GenerateInvoices({ members, invoices: invoiceTable }) {
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
                    createAnnualInvoices(members, invoiceTable, Number(firstInvoiceNumber),
                        invoiceDate, dueDate);
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

async function createAnnualInvoices(members, invoiceTable, firstInvoiceNumber, invoiceDate, dueDate) {
    var nextInvoiceNumber = firstInvoiceNumber;
    const newInvoices = members.flatMap(function (member) {
        const unsentInvoice = member.getCellValue('Unsent invoice');
        if (unsentInvoice) {
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
                "Membership of unsent invoice": [{ 'id': member.id }],
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
}

initializeBlock(() => <EYCManagement />);
