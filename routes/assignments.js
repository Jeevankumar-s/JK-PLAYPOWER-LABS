const express = require('express');
const { Assignment,Submission } = require('../models/database');
const { authenticateToken , requireRole} = require('../middleware/authenticateToken');
const nodemailer = require('nodemailer');
require('dotenv').config();

const router = express.Router();


async function sendNotificationEmail(studentEmail, assignmentTitle, dueDate, assignmentId) {
  let transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      // user: 'jeevanplaypower@gmail.com',
      // pass: 'xzbk ajyj dnpg opqu',
      user: process.env.USER_EMAIL,
      pass: process.env.USER_EMAIL_PASSWORD,
    },
  });

  let info = await transporter.sendMail({
    from: '"Play Power" <jeevanplaypower@gmail.com>',
    to: studentEmail,
    subject: 'New Assignment Created',
    html: `
      <p>Dear Student,</p>
      <p>A new assignment titled <strong>"${assignmentTitle}"</strong> has been created and assigned to you. Please find the details below:</p>
      <ul>
        <li><strong>Title:</strong> ${assignmentTitle}</li>
        <li><strong>Due Date:</strong> ${dueDate}</li>
      </ul>
      <p>You can view the assignment and submit your work through the following link:</p>
      <p><a href="https://docs.google.com/document/d/1HD6qaHFwMnZ3hoyFtxKegJjbJh2656e2Xz1cCd_6bIM/edit">View Assignment</a></p>
      <p>Please make sure to submit your work before the due date. If you have any questions, feel free to reach out to your instructor.</p>
      <p>Best Regards,</p>
       <p>${teacherName},</p>
      <p>PlayPower Labs.</p>
    `,
  });

  console.log('Message sent: %s', info.messageId);

}


router.use(authenticateToken);


router.get('/', async (req, res) => {
  const { sortBy } = req.query;

  const orderClause = [];
  if (sortBy) {
    const [key, order] = sortBy.split(':');
    orderClause.push([key, order.toUpperCase()]);
  }

  const cacheKey = `assignments:all:${JSON.stringify(orderClause)}`;

  try {
    const cachedAssignments = await req.redisClient.get(cacheKey);

    if (cachedAssignments) {
      return res.json(JSON.parse(cachedAssignments));
    }

    const assignments = await Assignment.findAll({
      order: orderClause,
    });

    await req.redisClient.set(cacheKey, JSON.stringify(assignments), 'EX', 3600);

    res.json(assignments);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



router.post('/assignments', authenticateToken, requireRole('teacher'), async (req, res) => {
  const { title, description, dueDate } = req.body;

  try {
    const parsedDueDate = new Date(dueDate);

    const assignmentData = await Assignment.create({
      title,
      description,
      dueDate: parsedDueDate,
      teacherId: req.user.id,
    });

    res.status(201).json(assignmentData);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});




router.get('/one/:id', async (req, res) => {
  try {
    const cacheKey = `assignment:${req.params.id}`;
    const cachedAssignment = await req.redisClient.get(cacheKey);

    if (cachedAssignment) {
      return res.json(JSON.parse(cachedAssignment));
    }

    const assignmentData = await Assignment.findByPk(req.params.id);

    if (!assignmentData) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    await req.redisClient.set(cacheKey, JSON.stringify(assignmentData), 'EX', 3600);

    res.json(assignmentData);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});



router.put('/:id', async (req, res) => {
  const { title, description, dueDate } = req.body;
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const assignmentData = await Assignment.findByPk(id);

    if (!assignmentData) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (assignmentData.teacherId !== userId) {
      return res.status(403).json({ message: 'You are not authorized to update this assignment' });
    }

    assignmentData.title = title || assignmentData.title;
    assignmentData.description = description || assignmentData.description;
    assignmentData.dueDate = dueDate || assignmentData.dueDate;

    await assignmentData.save();
    req.redisClient.del(`assignment:${id}`);

    res.status(200).json(assignmentData);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const assignment = await Assignment.findByPk(id);

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (assignment.teacherId !== userId) {
      return res.status(403).json({ message: 'You are not authorized to delete this assignment' });
    }

    await assignment.destroy();

    req.redisClient.del(`assignment:${id}`);

    res.status(200).json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/assignments/:id/submit', authenticateToken, requireRole('student'), async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  try {
    const submissionData = await Submission.create({
      studentId: req.user.id,
      assignmentId: id,
      content,
    });
    console.log(submissionData);

    res.status(201).json(submissionData);
  }catch (error) {
    console.error('Error while submitting assignment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
  
});

router.put('/submissions/:id/grade', async (req, res) => {
  const { id } = req.params;
  const { grade } = req.body;

  try {
    const submissionData = await Submission.findByPk(id);

    if (!submissionData) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    submissionData.grade = grade;
    await submissionData.save();

    res.json(submissionData);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/reports/:assignmentId', async (req, res) => {
  const { assignmentId } = req.params;

  try {
    const submissionData = await Submission.findAll({ where: { assignmentId } });

    res.json(submissionData);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  const { title, description, dueDate, studentEmail } = req.body;

  try {
    const assignmentData = await Assignment.create({ title, description, dueDate, teacherId: req.user.id });

    await sendNotificationEmail(studentEmail, title);

    res.status(201).json(assignmentData);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/submissions', async (req, res) => {
  const { dueDate, sortBy } = req.query;
  const whereClause = {};
  const orderClause = [];

  if (dueDate) {
    whereClause.dueDate = dueDate;  
  }

  if (sortBy) {
    const [key, order] = sortBy.split(':');
    orderClause.push([key, order.toUpperCase()]);
  } else {
    orderClause.push(['createdAt', 'ASC']);
  }

  const submissionsData = await Submission.findAll();
  console.log("fdknksdjnf",submissionsData)
  try {
    
    res.json(submissionsData);
  } catch (error) {
    console.error('Error while fetching submissions:', error);
    console.log(error) 
  res.status(500).json({ message: "error" });
}
});


module.exports = router;
