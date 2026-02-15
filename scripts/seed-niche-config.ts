import { getSupabaseAdmin } from '../packages/core/src/db/client.js';
import { createLogger } from '../packages/core/src/utils/logger.js';

const logger = createLogger('seed-niche-config');

// Default niche configurations
const NICHE_CONFIGS = [
  {
    id: 'electronics-recycling',
    display_name: 'Electronics Recycling',
    status: 'live' as const,
    config: {
      search_queries: [
        'electronics recycling near {city}',
        'e-waste recycling {city}',
        'old computer disposal {city}',
        'TV recycling {city}',
        'phone recycling {city}',
        'hazardous waste disposal {city}',
      ],
      service_flags: ['pickup', 'dropoff', 'residential', 'commercial', 'certified'],
      monetization: {
        affiliate_programs: ['Amazon Associates', 'Best Buy'],
        ad_cpm: 15,
      },
    },
    domain: 'recycleoldtech.com',
    opportunity_score: 85,
  },
  {
    id: 'mattress-recycling',
    display_name: 'Mattress Recycling',
    status: 'researching' as const,
    config: {
      search_queries: [
        'mattress recycling {city}',
        'old mattress disposal {city}',
        'mattress donation {city}',
        'sleep equipment recycling {city}',
        'furniture recycling {city}',
        'bulky item pickup {city}',
      ],
      service_flags: ['pickup', 'dropoff', 'residential', 'free_service'],
      monetization: {
        affiliate_programs: ['Mattress Firm', 'Purple'],
        ad_cpm: 12,
      },
    },
    opportunity_score: null,
  },
  {
    id: 'appliance-recycling',
    display_name: 'Appliance Recycling',
    status: 'researching' as const,
    config: {
      search_queries: [
        'appliance recycling {city}',
        'old refrigerator disposal {city}',
        'washer dryer pickup {city}',
        'metal recycling {city}',
        'scrap metal pickup {city}',
        'white goods recycling {city}',
      ],
      service_flags: ['pickup', 'dropoff', 'residential', 'commercial', 'free_service'],
      monetization: {
        affiliate_programs: ['Home Depot', 'Lowe\'s'],
        ad_cpm: 14,
      },
    },
    opportunity_score: null,
  },
  {
    id: 'tire-recycling',
    display_name: 'Tire Recycling',
    status: 'researching' as const,
    config: {
      search_queries: [
        'tire recycling {city}',
        'old tire disposal {city}',
        'rubber recycling {city}',
        'used tire pickup {city}',
        'tire shop {city}',
        'auto recycling {city}',
      ],
      service_flags: ['pickup', 'dropoff', 'commercial'],
      monetization: {
        affiliate_programs: ['Tire Rack', 'Discount Tire'],
        ad_cpm: 10,
      },
    },
    opportunity_score: null,
  },
  {
    id: 'construction-debris',
    display_name: 'Construction Debris Removal',
    status: 'researching' as const,
    config: {
      search_queries: [
        'construction debris removal {city}',
        'junk haul away {city}',
        'dumpster rental {city}',
        'roll off dumpster {city}',
        'debris disposal {city}',
        'renovation waste {city}',
      ],
      service_flags: ['pickup', 'dropoff', 'residential', 'commercial'],
      monetization: {
        affiliate_programs: ['Waste Management', 'Republic Services'],
        ad_cpm: 18,
      },
    },
    opportunity_score: null,
  },
];

async function seedNicheConfigs() {
  const supabase = getSupabaseAdmin();

  logger.info({ count: NICHE_CONFIGS.length }, 'Seeding niche configs');

  for (const niche of NICHE_CONFIGS) {
    const { error } = await supabase.from('niches').upsert({
      id: niche.id,
      display_name: niche.display_name,
      status: niche.status,
      config: niche.config,
      domain: niche.domain ?? null,
      opportunity_score: niche.opportunity_score,
    }, {
      onConflict: 'id',
    });

    if (error) {
      logger.error({ error, niche: niche.id }, 'Failed to seed niche');
      throw error;
    }

    logger.info({ niche: niche.id }, 'Seeded niche');
  }

  logger.info('Niche configs seeded successfully');
}

seedNicheConfigs().catch((error) => {
  logger.error({ error }, 'Failed to seed niche configs');
  process.exit(1);
});
