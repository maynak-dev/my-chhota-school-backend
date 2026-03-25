// Download receipt (stream PDF directly)
router.get('/receipt/:paymentId', auth, async (req, res) => {
  const { paymentId } = req.params;
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        fee: {
          include: {
            student: {
              include: { user: true, batch: true },
            },
          },
        },
      },
    });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    // Authorization checks (same as before)
    const studentId = payment.fee.studentId;
    if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
      if (student?.id !== studentId) return res.status(403).json({ error: 'Forbidden' });
    } else if (req.user.role === 'PARENT') {
      const parent = await prisma.parent.findUnique({ where: { userId: req.user.id }, include: { children: true } });
      if (!parent.children.some(c => c.id === studentId)) return res.status(403).json({ error: 'Forbidden' });
    } else if (req.user.role !== 'ADMIN' && req.user.role !== 'SUB_ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Generate PDF buffer
    const pdfBuffer = await generateReceiptBuffer(payment, payment.fee.student, payment.fee);

    // Send PDF to client
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt_${payment.receiptNo}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});