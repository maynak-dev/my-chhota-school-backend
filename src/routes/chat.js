const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');

// GET conversations list
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const sent = await prisma.chatMessage.findMany({
      where: { senderId: userId },
      select: { receiverId: true },
      distinct: ['receiverId'],
    });
    const received = await prisma.chatMessage.findMany({
      where: { receiverId: userId },
      select: { senderId: true },
      distinct: ['senderId'],
    });

    const contactIds = [...new Set([...sent.map(s => s.receiverId), ...received.map(r => r.senderId)])];
    const contacts = await prisma.user.findMany({
      where: { id: { in: contactIds } },
      select: { id: true, name: true, role: true, profilePic: true },
    });

    // Get last message and unread count for each contact
    const conversations = await Promise.all(contacts.map(async (contact) => {
      const lastMsg = await prisma.chatMessage.findFirst({
        where: { OR: [
          { senderId: userId, receiverId: contact.id },
          { senderId: contact.id, receiverId: userId },
        ]},
        orderBy: { createdAt: 'desc' },
      });
      const unread = await prisma.chatMessage.count({
        where: { senderId: contact.id, receiverId: userId, isRead: false },
      });
      return { ...contact, lastMessage: lastMsg, unreadCount: unread };
    }));

    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET messages with a user
router.get('/messages/:userId', authenticate, async (req, res) => {
  try {
    const myId = req.user.id;
    const otherId = req.params.userId;

    const messages = await prisma.chatMessage.findMany({
      where: { OR: [
        { senderId: myId, receiverId: otherId },
        { senderId: otherId, receiverId: myId },
      ]},
      orderBy: { createdAt: 'asc' },
    });

    // Mark received messages as read
    await prisma.chatMessage.updateMany({
      where: { senderId: otherId, receiverId: myId, isRead: false },
      data: { isRead: true },
    });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST send message
router.post('/send', authenticate, async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    const msg = await prisma.chatMessage.create({
      data: { senderId: req.user.id, receiverId, message },
    });
    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;