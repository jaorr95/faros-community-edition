import {program} from 'commander';
import {VError} from 'verror';

import {Airbyte} from './airbyte/airbyte-client';
import {makeBitbucketCommand, runBitbucket} from './bitbucket/run';
import {makeGithubCommand, runGithub} from './github/run';
import {makeGitlabCommand, runGitlab} from './gitlab/run';
import {makeJiraCommand, runJira} from './jira/run';
import {display, terminalLink} from './utils';
import {runSelect} from './utils/prompts';

const DEFAULT_AIRBYTE_URL = 'http://localhost:8000';
const DEFAULT_METABASE_URL = 'http://localhost:3000';

export function wrapApiError(cause: unknown, msg: string): Error {
  // Omit verbose axios error
  const truncated = new VError((cause as Error).message);
  return new VError(truncated, msg);
}

// eslint-disable-next-line require-await
export async function main(): Promise<void> {
  program.addCommand(makeGithubCommand());
  program.addCommand(makeGitlabCommand());
  program.addCommand(makeBitbucketCommand());
  program.addCommand(makeJiraCommand());

  // Commander doesn't allow for empty subcommand names, even if the subcommand
  // is marked as default. Users can omit the subcommand below though, which is
  // the behavior we want. We just need to name it something to make commander
  // happy.
  program
    .command('pick-source', {isDefault: true, hidden: true})
    .action(async (options) => {
      const airbyte = new Airbyte(options.airbyteUrl);
      let done = false;
      while (!done) {
        const source = await runSelect({
          name: 'source',
          message: 'Select a source',
          choices: [
            'GitHub (Cloud)',
            'GitLab (Cloud / Server)',
            'Bitbucket (Cloud / Server)',
            'Jira (Cloud)',
            'I\'m done!',
          ],
        });
        switch (source) {
          case 'GitHub (Cloud)':
            await runGithub({airbyte});
            break;
          case 'GitLab (Cloud / Server)':
            await runGitlab({airbyte});
            break;
          case 'Bitbucket (Cloud / Server)':
            await runBitbucket({airbyte});
            break;
          case 'Jira (Cloud)':
            await runJira({airbyte});
            break;
          case 'I\'m done!':
            done = true;
        }
      }
    });

  program.commands.forEach((cmd) => {
    cmd.option('--airbyte-url <string>', 'Airbyte URL', DEFAULT_AIRBYTE_URL);
    cmd
      .option('--metabase-url <string>', 'Metabase URL', DEFAULT_METABASE_URL)
      .hook('postAction', async (thisCommand) => {
        display(
          `Check out your metrics in ${await terminalLink(
            'Metabase',
            thisCommand.opts().metabaseUrl
          )}`
        );
        display(
          'Default admin login credentials are admin@admin.com / admin. ' +
            `To learn how to set them, visit ${await terminalLink(
              'Setting Admin Credentials page',
              'https://community.faros.ai/docs/setting-admin-credentials'
            )}.`
        );
      });
  });

  program.parse();
}