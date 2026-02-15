// Placeholder CLI entry point
// TODO: Implement commands

import { Command } from 'commander';

const program = new Command();

program
  .name('swarm')
  .description('Directory Swarm - AI-powered business directory builder')
  .version('0.1.0');

program.parse();
