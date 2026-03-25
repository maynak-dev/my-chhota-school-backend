const PDFDocument = require('pdfkit');

/**
 * Generate a PDF receipt and return it as a buffer.
 * @param {Object} payment - Payment record with amount, receiptNo, etc.
 * @param {Object} student - Student object with user, batch, etc.
 * @param {Object} fee - Fee record with totalFees, paidAmount, dueDate.
 * @returns {Promise<Buffer>} - PDF buffer.
 */
const generateReceiptBuffer = async (payment, student, fee) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Write content
    doc.fontSize(20).text('FEE RECEIPT', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`Receipt No: ${payment.receiptNo}`);
    doc.text(`Date: ${new Date(payment.date).toLocaleDateString()}`);
    doc.text(`Student Name: ${student.user.name}`);
    doc.text(`Roll Number: ${student.rollNumber}`);
    doc.text(`Batch: ${student.batch.name}`);
    doc.text(`Amount: ₹${payment.amount}`);
    doc.text(`Payment Method: ${payment.method}`);
    doc.text(`Transaction ID: ${payment.transactionId || 'N/A'}`);
    doc.text(`Total Fee: ₹${fee.totalFees}`);
    doc.text(`Paid Amount: ₹${fee.paidAmount}`);
    doc.text(`Balance Due: ₹${fee.totalFees - fee.paidAmount}`);
    doc.text(`Next Due Date: ${new Date(fee.dueDate).toLocaleDateString()}`);
    doc.moveDown();
    doc.text('Thank you for your payment!', { align: 'center' });

    doc.end();
  });
};

module.exports = { generateReceiptBuffer };