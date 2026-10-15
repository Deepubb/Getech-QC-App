import { FileSpreadsheet, FilePlus2, LayoutTemplate, Download, ChevronRight } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBar, toast } from '../components/ui';
import { downloadBlob } from '../export/share';
import { useApp } from '../data/store';
import { plural } from '../core/format';

export function NewChecklist() {
  const nav = useNavigate();
  const { templates, setDraft } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  // A draft is only kept while its details screen is open; starting over clears it.
  useEffect(() => setDraft(null), [setDraft]);

  async function onExcel(file: File) {
    try {
      // SheetJS is large, so it only loads when someone imports a file.
      const { parseChecklistWorkbook } = await import('../core/excelParser');
      const parsed = parseChecklistWorkbook(await file.arrayBuffer());
      setDraft({
        source: 'excel',
        fileName: file.name,
        machine: { machineName: parsed.machine.machineName, machineCode: parsed.machine.machineCode, customer: parsed.machine.customer, cwo: parsed.machine.cwo },
        items: parsed.items,
        photoPlan: parsed.photoPlan,
        errors: parsed.errors,
        warnings: parsed.warnings,
        categoryCount: parsed.categoryCount,
      });
      nav('/checklists/new/details');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That file could not be read.', 'bad');
    }
  }

  return (
    <div className="shell">
      <AppBar title="New QC checklist" />
      <main className="content">
        <p className="muted">Pick where the checklist items come from. You fill in the machine details next.</p>

        {templates.length > 0 ? (
          <>
            <div className="section-title">
              <h2>Saved templates</h2>
            </div>
            <div className="list">
              {[...templates]
                .sort((a, b) => a.machineCode.localeCompare(b.machineCode))
                .map((t) => (
                  <button
                    key={t.id}
                    className="li"
                    onClick={() => {
                      setDraft({ source: 'template', machine: { machineName: t.machineName, machineCode: t.machineCode, customer: t.customer, cwo: '' }, items: t.items, photoPlan: [], errors: [], warnings: [], categoryCount: new Set(t.items.map((i) => i.category)).size });
                      nav('/checklists/new/details');
                    }}
                  >
                    <LayoutTemplate className="muted" />
                    <span className="t">
                      <b>{t.machineName}</b>
                      <div className="s mono">
                        {t.machineCode} · {plural(t.items.length, 'item')}
                        {t.version ? ` · ${t.version}` : ''}
                      </div>
                    </span>
                    <ChevronRight className="muted" />
                  </button>
                ))}
            </div>
          </>
        ) : null}

        <div className="section-title">
          <h2>Other ways</h2>
        </div>
        <div className="list">
          <button className="li" onClick={() => fileRef.current?.click()}>
            <FileSpreadsheet className="muted" />
            <span className="t">
              <b>Import an Excel checklist</b>
              <div className="s">Sheets: Checklist and MachineInfo, same columns as today.</div>
            </span>
            <ChevronRight className="muted" />
          </button>
          <button
            className="li"
            onClick={() => {
              setDraft({ source: 'blank', machine: { machineName: '', machineCode: '', customer: '', cwo: '' }, items: [], photoPlan: [], errors: [], warnings: [], categoryCount: 0 });
              nav('/checklists/new/details');
            }}
          >
            <FilePlus2 className="muted" />
            <span className="t">
              <b>Start empty</b>
              <div className="s">Add the items yourself in the checklist editor.</div>
            </span>
            <ChevronRight className="muted" />
          </button>
        </div>

        <button
          className="btn btn-ghost"
          onClick={async () => {
            const { buildChecklistTemplateWorkbook } = await import('../core/excelParser');
            downloadBlob(new Blob([buildChecklistTemplateWorkbook() as BlobPart]), 'getech-qc-checklist-template.xlsx');
          }}
        >
          <Download />
          Download a blank Excel template
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void onExcel(f);
          }}
        />
      </main>
    </div>
  );
}
