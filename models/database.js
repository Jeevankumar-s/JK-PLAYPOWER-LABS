const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './db/sqlite.db'
});

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('student', 'teacher'),
    allowNull: false,
  },
});


const Assignment = sequelize.define('Assignment', {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  teacherId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
});

const Submission = sequelize.define('Submission', {
  studentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  assignmentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  submittedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  grade: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});


sequelize.sync({ force: false }).then(() => {
  console.log('Database & tables created!');
});

module.exports = { User, Assignment, sequelize ,Submission};
