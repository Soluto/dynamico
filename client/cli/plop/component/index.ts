import uppercamelcase from 'uppercamelcase';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { getVersionsForDependencies } from '../utils';
import { Plop } from '../typings';

export default (plop: Plop) => {
  plop.addHelper('upperCase', (word: string) => uppercamelcase(word));
  plop.addHelper('areEqual', function(this: any, lval, rval, options) {
    if (lval === rval) {
      return options.fn(this);
    }
    return options.inverse(this);
  });

  plop.setGenerator('component', {
    description: 'create a dynamic component',
    prompts: [
      {
        type: 'input',
        name: 'path'
      },
      {
        type: 'input',
        name: 'name',
        message: 'What is the name of your component?',
        validate: ({ length }) => (length ? true : 'name is required')
      },
      {
        type: 'list',
        name: 'language',
        message: 'What language are you developing in?',
        choices: [{ name: 'Typescript', value: 'ts' }, { name: 'Javascript', value: 'js' }]
      },
      {
        type: 'list',
        name: 'framework',
        message: 'What framework are you using?',
        choices: () => {
          return readdirSync('./plop/component')
            .filter(filename => statSync(join('./plop/component', filename)).isDirectory())
            .map(value => ({ name: uppercamelcase(value), value }));
        }
      },
      {
        type: 'input',
        name: 'component-version',
        message: 'What is version of your component?',
        default: '1.0.0',
        validate: version => (/^\d+\.\d+\.\d+/.test(version) ? true : 'version format is: [major].[minor].[patch]')
      }
    ],
    actions: data => [
      {
        type: 'add',
        path: '{{path}}/index.{{language}}x',
        templateFile: 'plop/component/{{framework}}/index.hbs'
      },
      {
        type: 'add',
        path: '{{path}}/package.json',
        templateFile: 'plop/component/{{framework}}/package.hbs',
        data: () => {
          const { dependencies, devDependencies, peerDependencies } = JSON.parse(
            plop.renderString(readFileSync(`./plop/component/${data.framework}/package.hbs`, 'utf-8'), data)
          );
          return getVersionsForDependencies(Object.keys({ ...dependencies, ...devDependencies, ...peerDependencies }));
        }
      },
      {
        type: 'add',
        path: '{{path}}/dcmconfig.{{language}}',
        templateFile: 'plop/component/{{framework}}/dcmconfig.hbs'
      },
      {
        type: 'add',
        path: '{{path}}/.gitignore',
        templateFile: 'plop/component/{{framework}}/gitignore.hbs'
      },
      ...(data.language === 'ts'
        ? [
            {
              type: 'add',
              path: '{{path}}/tsconfig.json',
              templateFile: 'plop/component/{{framework}}/tsconfig.hbs'
            }
          ]
        : [])
    ]
  });
};
