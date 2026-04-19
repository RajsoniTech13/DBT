const bcrypt = require('bcryptjs');
const { User, sequelize } = require('../models');

const seedUsers = async () => {
  try {
    await sequelize.sync(); // Ensure tables exist

    const password = 'Password@123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const users = [
      {
        name: 'State Admin',
        email: 'admin@dbt.gov.in',
        password_hash: hashedPassword,
        role: 'ADMIN',
        district: 'Gandhinagar',
        employeeId: 'ADM-GJ-001'
      },
      {
        name: 'Ahmedabad DFO',
        email: 'dfo.ahmedabad@dbt.gov.in',
        password_hash: hashedPassword,
        role: 'DFO',
        district: 'Ahmedabad',
        employeeId: 'DFO-AHM-012'
      },
      {
        name: 'Ahmedabad Verifier 1',
        email: 'v1.ahmedabad@dbt.gov.in',
        password_hash: hashedPassword,
        role: 'VERIFIER',
        district: 'Ahmedabad',
        employeeId: 'VER-AHM-045'
      },
      {
        name: 'State Auditor',
        email: 'auditor@dbt.gov.in',
        password_hash: hashedPassword,
        role: 'AUDITOR',
        district: 'Gandhinagar',
        employeeId: 'AUD-GJ-009'
      }
    ];

    for (const userData of users) {
      await User.findOrCreate({
        where: { email: userData.email },
        defaults: userData
      });
    }

    console.log('✅ Mock users seeded successfully with Employee IDs:');
    console.log('   - Admin: admin@dbt.gov.in (ADM-GJ-001)');
    console.log('   - DFO: dfo.ahmedabad@dbt.gov.in (DFO-AHM-012)');
    console.log('   - Verifier: v1.ahmedabad@dbt.gov.in (VER-AHM-045)');
    console.log('   - Auditor: auditor@dbt.gov.in (AUD-GJ-009)');

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed users:', error);
    process.exit(1);
  }
};

seedUsers();
