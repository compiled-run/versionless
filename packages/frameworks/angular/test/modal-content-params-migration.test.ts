import { describe, expect, it } from 'vitest';
import {
	migrateModalContentParams,
	type ModuleFile,
} from '../src/modal-content-params-migration.ts';

/**
 * The shape an era workspace carries: a component that opens a modal and
 * supplies fields onto the content component's instance, and the content
 * component that declares those fields as ordinary `@Input()`s and asks the
 * injector for nothing. Version 16 provides `nzData` on `NZ_MODAL_DATA` and
 * assigns nothing, so both files have to move together.
 */
const callSite = `import { Component } from '@angular/core';
import { NzModalService } from 'ng-zorro-antd/modal';
import { ContentComponent } from './content.component';

@Component({ selector: 'card', template: '' })
export class CardComponent {
  constructor(private _modalService: NzModalService, private _query: Query) {}

  openModal(id: string) {
    this._modalService.create({
      nzContent: ContentComponent,
      nzWidth: 1040,
      nzFooter: null,
      nzComponentParams: {
        issue$: this._query.issueById$(id)
      }
    });
  }
}
`;

const contentComponent = `import { Component, Input } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { Observable } from 'rxjs';

@Component({ selector: 'content', template: '' })
export class ContentComponent {
  @Input() issue$: Observable<number>;
  title = 'untouched';

  constructor(private _modal: NzModalRef) {}
}
`;

const tree = (): readonly ModuleFile[] => [
	{ path: 'src/app/card.component.ts', source: callSite },
	{ path: 'src/app/content.component.ts', source: contentComponent },
];

const fileAt = (
	migration: ReturnType<typeof migrateModalContentParams>,
	path: string,
): { path: string; source: string; changed: boolean } => {
	const found = migration.files.find((entry) => entry.path === path);
	if (found === undefined) throw new Error(`no migrated file for ${path}`);
	return found;
};

describe('modal content-params migration', () => {
	it('renames the option and makes the content component inject exactly what it was given', () => {
		const migration = migrateModalContentParams(tree());
		expect(migration.unhandled).toEqual([]);
		expect(fileAt(migration, 'src/app/card.component.ts').source)
			.toBe(`import { Component } from '@angular/core';
import { NzModalService } from 'ng-zorro-antd/modal';
import { ContentComponent } from './content.component';

@Component({ selector: 'card', template: '' })
export class CardComponent {
  constructor(private _modalService: NzModalService, private _query: Query) {}

  openModal(id: string) {
    this._modalService.create({
      nzContent: ContentComponent,
      nzWidth: 1040,
      nzFooter: null,
      nzData: {
        issue$: this._query.issueById$(id)
      }
    });
  }
}
`);
		expect(fileAt(migration, 'src/app/content.component.ts')
			.source).toBe(`import { Component, Input, inject } from '@angular/core';
import { NzModalRef, NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import { Observable } from 'rxjs';

@Component({ selector: 'content', template: '' })
export class ContentComponent {
  issue$: Observable<number> = inject(NZ_MODAL_DATA).issue$;
  title = 'untouched';

  constructor(private _modal: NzModalRef) {}
}
`);
	});

	it('records both halves of the rewrite as changes on the files they landed in', () => {
		const migration = migrateModalContentParams(tree());
		expect(fileAt(migration, 'src/app/card.component.ts')).toMatchObject({ changed: true });
		expect(migration.files.flatMap((entry) => entry.changes)).toEqual([
			{
				kind: 'modal-content-params-option',
				path: 'src/app/card.component.ts',
				line: 14,
				from: 'nzComponentParams: { issue$ }',
				to: 'nzData: { issue$ }',
			},
			{
				kind: 'modal-content-data-injection',
				path: 'src/app/content.component.ts',
				line: 7,
				from: '@Input() issue$',
				to: 'issue$ = inject(NZ_MODAL_DATA).issue$',
			},
		]);
	});

	it('injects a field with no annotation and no decorator by replacing its initialiser', () => {
		const deleteModal = `import { Component, EventEmitter } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';

@Component({ selector: 'delete', template: '' })
export class DeleteComponent {
  issueId: string;
  onDelete = new EventEmitter<string>();
  note: string;

  constructor(private _modalRef: NzModalRef) {}
}
`;
		const opener = `import { Component } from '@angular/core';
import { NzModalService } from 'ng-zorro-antd/modal';
import { DeleteComponent } from './delete.component';

@Component({ selector: 'detail', template: '' })
export class DetailComponent {
  constructor(private _modalService: NzModalService) {}

  open() {
    this._modalService.create({
      nzContent: DeleteComponent,
      nzComponentParams: {
        issueId: this.issue.id,
        onDelete: this.onDelete
      }
    });
  }
}
`;
		const migration = migrateModalContentParams([
			{ path: 'src/app/delete.component.ts', source: deleteModal },
			{ path: 'src/app/detail.component.ts', source: opener },
		]);
		expect(migration.unhandled).toEqual([]);
		const migrated = fileAt(migration, 'src/app/delete.component.ts').source;
		expect(migrated).toContain('  issueId: string = inject(NZ_MODAL_DATA).issueId;');
		expect(migrated).toContain('  onDelete = inject(NZ_MODAL_DATA).onDelete;');
		/** A field no call supplied is not injected: nothing would be there to read. */
		expect(migrated).toContain('  note: string;');
		expect(migrated).not.toContain('note: string = inject');
		expect(fileAt(migration, 'src/app/detail.component.ts').source).toContain('nzData: {');
	});

	it('adds a whole import declaration when the content module imports the modal surface nowhere', () => {
		const content = `import { Component, Input } from '@angular/core';

@Component({ selector: 'content', template: '' })
export class ContentComponent {
  @Input() issue$: unknown;
}
`;
		const migration = migrateModalContentParams([
			{ path: 'src/app/card.component.ts', source: callSite },
			{ path: 'src/app/content.component.ts', source: content },
		]);
		expect(migration.unhandled).toEqual([]);
		expect(fileAt(migration, 'src/app/content.component.ts').source)
			.toBe(`import { Component, Input, inject } from '@angular/core';
import { NZ_MODAL_DATA } from 'ng-zorro-antd/modal';

@Component({ selector: 'content', template: '' })
export class ContentComponent {
  issue$: unknown = inject(NZ_MODAL_DATA).issue$;
}
`);
	});

	it('rewrites two call sites that supply the same fields to one content component once', () => {
		const second = callSite.replace('card', 'drawer').replace('CardComponent', 'DrawerComponent');
		const migration = migrateModalContentParams([
			...tree(),
			{ path: 'src/app/drawer.component.ts', source: second },
		]);
		expect(migration.unhandled).toEqual([]);
		expect(fileAt(migration, 'src/app/drawer.component.ts').source).toContain('nzData: {');
		expect(
			fileAt(migration, 'src/app/content.component.ts').source.split('inject(NZ_MODAL_DATA)')
				.length - 1,
		).toBe(1);
	});

	it('resolves a content component reached through a workspace path alias', () => {
		const aliased = callSite.replace("'./content.component'", "'@app/content.component'");
		const migration = migrateModalContentParams(
			[
				{ path: 'src/app/card.component.ts', source: aliased },
				{ path: 'src/app/content.component.ts', source: contentComponent },
			],
			{ baseUrl: 'src', paths: { '@app/*': ['app/*'] } },
		);
		expect(migration.unhandled).toEqual([]);
		expect(fileAt(migration, 'src/app/content.component.ts').changed).toBe(true);
	});

	it('leaves a tree with no removed option byte-identical', () => {
		const clean = callSite.replace('nzComponentParams', 'nzData');
		const migration = migrateModalContentParams([
			{ path: 'src/app/card.component.ts', source: clean },
			{ path: 'src/app/content.component.ts', source: contentComponent },
		]);
		expect(migration.files.every((entry) => !entry.changed)).toBe(true);
		expect(migration.unhandled).toEqual([]);
	});
});

describe('modal content-params refusals', () => {
	const expectUntouched = (
		migration: ReturnType<typeof migrateModalContentParams>,
		reason: string,
	): void => {
		expect(migration.files.every((entry) => !entry.changed)).toBe(true);
		expect(migration.unhandled.join('\n')).toContain(reason);
	};

	it('refuses a content component whose declaring module it was not handed', () => {
		expectUntouched(
			migrateModalContentParams([{ path: 'src/app/card.component.ts', source: callSite }]),
			'does not resolve to a module this migration was handed',
		);
	});

	it('refuses a content option that is not an imported component identifier', () => {
		const inline = callSite.replace('nzContent: ContentComponent', "nzContent: 'a template'");
		expectUntouched(
			migrateModalContentParams([
				{ path: 'src/app/card.component.ts', source: inline },
				{ path: 'src/app/content.component.ts', source: contentComponent },
			]),
			'is not a component identifier',
		);
	});

	it('refuses a field the content component does not declare', () => {
		const missing = contentComponent.replace('@Input() issue$: Observable<number>;', '');
		expectUntouched(
			migrateModalContentParams([
				{ path: 'src/app/card.component.ts', source: callSite },
				{ path: 'src/app/content.component.ts', source: missing },
			]),
			'declares no field issue$',
		);
	});

	it('refuses a content component also opened by a call supplying no parameters', () => {
		const paramless = `import { Component } from '@angular/core';
import { NzModalService } from 'ng-zorro-antd/modal';
import { ContentComponent } from './content.component';

@Component({ selector: 'nav', template: '' })
export class NavComponent {
  constructor(private _modalService: NzModalService) {}

  open() {
    this._modalService.create({ nzContent: ContentComponent, nzFooter: null });
  }
}
`;
		expectUntouched(
			migrateModalContentParams([
				...tree(),
				{ path: 'src/app/nav.component.ts', source: paramless },
			]),
			'which would provide no NZ_MODAL_DATA for the injected fields to read',
		);
	});

	it('refuses two calls that supply different field sets to one content component', () => {
		const other = callSite
			.replace('card', 'drawer')
			.replace('CardComponent', 'DrawerComponent')
			.replace('issue$: this._query.issueById$(id)', 'title: id');
		expectUntouched(
			migrateModalContentParams([
				...tree(),
				{ path: 'src/app/drawer.component.ts', source: other },
			]),
			'supplying different nzComponentParams field sets',
		);
	});

	it('refuses a call that already declares the option it would be rewritten into', () => {
		const contested = callSite.replace('nzWidth: 1040,', "nzWidth: 1040,\n      nzData: { x: 1 },");
		expectUntouched(
			migrateModalContentParams([
				{ path: 'src/app/card.component.ts', source: contested },
				{ path: 'src/app/content.component.ts', source: contentComponent },
			]),
			'it already declares nzData',
		);
	});

	it('refuses a receiver it cannot resolve to the modal service', () => {
		const foreign = callSite.replace(
			'constructor(private _modalService: NzModalService, private _query: Query) {}',
			'constructor(private _modalService: SomeOtherService, private _query: Query) {}',
		);
		expectUntouched(
			migrateModalContentParams([
				{ path: 'src/app/card.component.ts', source: foreign },
				{ path: 'src/app/content.component.ts', source: contentComponent },
			]),
			'a receiver this capability cannot resolve to ng-zorro-antd/modal',
		);
	});

	it('refuses a field carrying a decorator other than @angular/core’s Input', () => {
		const decorated = contentComponent
			.replace(
				"import { Component, Input } from '@angular/core';",
				"import { Component, Input } from '@angular/core';\nimport { Select } from '@ngxs/store';",
			)
			.replace('@Input() issue$', '@Select() issue$');
		expectUntouched(
			migrateModalContentParams([
				{ path: 'src/app/card.component.ts', source: callSite },
				{ path: 'src/app/content.component.ts', source: decorated },
			]),
			"carries a decorator other than @angular/core's Input",
		);
	});

	it('refuses a params value that is not a plain object literal', () => {
		const spread = callSite.replace(
			'issue$: this._query.issueById$(id)',
			'...this._query.params(id)',
		);
		expectUntouched(
			migrateModalContentParams([
				{ path: 'src/app/card.component.ts', source: spread },
				{ path: 'src/app/content.component.ts', source: contentComponent },
			]),
			'is not a plain object literal',
		);
	});

	it('fails naming a module that does not parse rather than counting it unchanged', () => {
		expect(() =>
			migrateModalContentParams([
				{ path: 'src/app/broken.component.ts', source: 'const x = { nzContent: ;' },
			]),
		).toThrow('src/app/broken.component.ts does not parse');
	});
});
