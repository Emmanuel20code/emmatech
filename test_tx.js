const { Payment, Session } = require('./dist/models');
const { Sequelize } = require('sequelize');

async function check() {
  const payments = await Payment.findAll({
    include: [{ model: Session, required: false }],
    order: [['createdAt', 'DESC']],
    limit: 20
  });
  console.log("Returned payment count:", payments.length);
  const ids = payments.map(p => p.id);
  const duplicates = ids.filter((item, index) => ids.indexOf(item) !== index);
  console.log("Duplicates:", duplicates);
  
  if (duplicates.length > 0) {
     const dup = await Payment.findAll({ where: { id: duplicates[0] } });
     console.log("Duplicate row:", dup);
  }
}
check().catch(console.error).then(() => process.exit(0));
