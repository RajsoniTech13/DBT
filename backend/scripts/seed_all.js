/**
 * Seed all prerequisite data:
 * - Users (DFO, Verifiers, Auditor, Admin) with bcrypt-hashed passwords
 * - System detection rules
 */
const bcrypt = require('bcryptjs');
const { User, SystemConfig, sequelize } = require('../models');

const seedAll = async () => {
  try {
    await sequelize.sync();
    console.log('✅ Database synced.');

    // ── 1. Seed Users ──────────────────────────────────
    const password = await bcrypt.hash('12345678', 10);

    const users = [
      { name: 'DFO Officer',      email: 'dfo@dbtguard.in',       password_hash: password, role: 'DFO',      district: 'Ahmedabad' },
      { name: 'Field Verifier',   email: 'verifier@dbtguard.in',  password_hash: password, role: 'VERIFIER', district: 'Ahmedabad' },
      { name: 'Rajesh Kumar',     email: 'verifier2@dbtguard.in', password_hash: password, role: 'VERIFIER', district: 'Ahmedabad' },
      { name: 'Priya Sharma',     email: 'verifier3@dbtguard.in', password_hash: password, role: 'VERIFIER', district: 'Ahmedabad' },
      { name: 'Audit Inspector',  email: 'auditor@dbtguard.in',   password_hash: password, role: 'AUDITOR',  district: 'Gujarat State' },
      { name: 'State Admin',      email: 'admin@dbtguard.in',     password_hash: password, role: 'ADMIN',    district: 'Gujarat State' },
    ];

    for (const u of users) {
      const [user, created] = await User.findOrCreate({
        where: { email: u.email },
        defaults: u
      });
      console.log(`   ${created ? '✨ Created' : '⏭  Exists'}: ${u.role} → ${u.email}`);
    }

    // ── 2. Seed Detection Rules ────────────────────────
    const rules = [
      {
        name: 'Deceased Beneficiary Detection',
        description: 'Flags transactions where the beneficiary is marked as deceased in secondary databases.',
        severity: 'High',
        is_enabled: true,
        threshold_value: { matched_records: 1 }
      },
      {
        name: 'Multiple Scheme Enrollment (Double Dipping)',
        description: 'Detects beneficiaries receiving similar benefits from multiple schemes.',
        severity: 'High',
        is_enabled: true,
        threshold_value: { max_schemes: 1 }
      },
      {
        name: 'Abnormal Withdrawal Patterns',
        description: 'Flags transactions with unusual timing or location patterns.',
        severity: 'Medium',
        is_enabled: true,
        threshold_value: { window_hours: 2, distance_km: 50 }
      },
      {
        name: 'High Frequency Transfers',
        description: 'Flags beneficiaries receiving an unusual number of transfers within a short period.',
        severity: 'Low',
        is_enabled: true,
        threshold_value: { max_transfers_per_month: 3 }
      }
    ];

    for (const rule of rules) {
      const [config, created] = await SystemConfig.findOrCreate({
        where: { name: rule.name },
        defaults: rule
      });
      console.log(`   ${created ? '✨ Created' : '⏭  Exists'}: Rule → ${rule.name}`);
    }

    console.log('\n🎉 All seed data inserted successfully!');
    console.log('\n── Login Credentials ──────────────────────');
    console.log('   DFO:       dfo@dbtguard.in           / 12345678');
    console.log('   Verifier:  verifier@dbtguard.in      / 12345678');
    console.log('   Verifier2: verifier2@dbtguard.in     / 12345678');
    console.log('   Verifier3: verifier3@dbtguard.in     / 12345678');
    console.log('   Auditor:   auditor@dbtguard.in       / 12345678');
    console.log('   Admin:     admin@dbtguard.in         / 12345678');
    console.log('──────────────────────────────────────────');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
};

seedAll();
