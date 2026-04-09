const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');

// ─── Subscription Plans ────────────────────────────────
router.get('/plans', authenticate, async (req, res) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({ where: { isActive: true } });
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/plans', authenticate, roleCheck(['ADMIN']), async (req, res) => {
  try {
    const plan = await prisma.subscriptionPlan.create({ data: req.body });
    res.status(201).json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/plans/:id', authenticate, roleCheck(['ADMIN']), async (req, res) => {
  try {
    const plan = await prisma.subscriptionPlan.update({ where: { id: req.params.id }, data: req.body });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Coupons ────────────────────────────────────────────
router.get('/coupons', authenticate, roleCheck(['ADMIN']), async (req, res) => {
  try {
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(coupons);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/coupons', authenticate, roleCheck(['ADMIN']), async (req, res) => {
  try {
    const coupon = await prisma.coupon.create({ data: {
      ...req.body,
      validFrom: new Date(req.body.validFrom),
      validTo: new Date(req.body.validTo),
    }});
    res.status(201).json(coupon);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST validate coupon
router.post('/coupons/validate', authenticate, async (req, res) => {
  try {
    const { code, amount } = req.body;
    const coupon = await prisma.coupon.findUnique({ where: { code } });
    if (!coupon || !coupon.isActive) return res.status(404).json({ error: 'Invalid coupon' });
    if (new Date() < coupon.validFrom || new Date() > coupon.validTo) return res.status(400).json({ error: 'Coupon expired' });
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) return res.status(400).json({ error: 'Coupon usage limit reached' });

    const discount = coupon.discountType === 'PERCENTAGE'
      ? (amount * coupon.discountValue / 100)
      : coupon.discountValue;

    res.json({ valid: true, discount: Math.min(discount, amount), finalAmount: Math.max(0, amount - discount) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── EMI Plans ──────────────────────────────────────────
router.post('/emi', authenticate, roleCheck(['ADMIN']), async (req, res) => {
  try {
    const { feeId, installments } = req.body;
    const fee = await prisma.fee.findUnique({ where: { id: feeId } });
    if (!fee) return res.status(404).json({ error: 'Fee not found' });

    const remaining = fee.totalFees - fee.paidAmount;
    const amountPerEMI = Math.ceil(remaining / installments);
    const nextDueDate = new Date();
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);

    const emi = await prisma.eMIPlan.create({
      data: { feeId, totalAmount: remaining, installments, amountPerEMI, nextDueDate },
    });
    res.status(201).json(emi);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/emi/fee/:feeId', authenticate, async (req, res) => {
  try {
    const emi = await prisma.eMIPlan.findMany({ where: { feeId: req.params.feeId } });
    res.json(emi);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;