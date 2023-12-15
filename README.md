# EYC management

This is an Airtable extension for the
[EYC membership & marina](https://airtable.com/appQRBDxWHa1GAYWt?ao=cmVjZW50)
base. It provides bulk operations customized to that database.

Airtable has
[excellent documentation](https://airtable.com/developers/extensions) on writing
extensions.

## Accessing the extension

To use the extension, click on the Extensions tab at the top right of Airtable
to open the extensions panel. Each operation has a brief explanation, possibly
some input fields, and a button to start the operation.

## Bulk operations

### Create annual membership invoices (in progress)

Run this at the end of the year to generate membership invoices for the upcoming
year. Invoices are based on the membership types of the members, building
assessments, and the slip/mooring assignments of member vessels.

After the script generates the invoices within Airtable, you can review and edit
them as needed before they are exported to Quickbooks.

Before running this script, check that memberships have the correct membership
types, that vessels have the correct owners and slip/mooring assignments, and
that the annual dues in the member types table are correct.

### Export invoices to Quickbooks (unimplemented)

Converts all of the unsent invoices in Airtable to a CSV file that you can
upload to QuickBooks, and then marks those invoices as "sent" in Airtable.

### Export membership log (unimplemented)

Exports all current memberships to a CSV file that can be mail-merged into the
EYC log.
