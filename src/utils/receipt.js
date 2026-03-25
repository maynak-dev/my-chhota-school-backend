const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const receiptsDir = path.join(__dirname, '../receipts');
if (!fs.existsSync(receiptsDir)) fs.mkdirSync(receiptsDir);

const generateReceipt = async (payment, student, fee) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const filePath = path.join(receiptsDir, `receipt_${payment.receiptNo}.pdf`);
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

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
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
};

module.exports = { generateReceipt };