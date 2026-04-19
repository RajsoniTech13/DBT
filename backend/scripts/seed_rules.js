const { SystemConfig, sequelize } = require('../models');

const seedRules = async () => {
  try {
    await sequelize.sync();

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
      await SystemConfig.findOrCreate({
        where: { name: rule.name },
        defaults: rule
      });
    }

    console.log('✅ Detection Rules seeded successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed rules:', error);
    process.exit(1);
  }
};

seedRules();
