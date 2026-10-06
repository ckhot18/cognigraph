import { useCallback, useEffect, useState } from 'react';
import { api, DEMO_DELAY_MS } from '../api.js';
import PresetBar from './PresetBar.jsx';
import SubmissionPanel from './SubmissionPanel.jsx';
import DiagnosticReport from './DiagnosticReport.jsx';

// Student Diagnostic Hub: owns preset selection, analysis runs, bridge updates.
export default function StudentHub({ initialPresetId, onExternalPreset }) {
  const [presets, setPresets] = useState([]);
  const [presetId, setPresetId] = useState(initialPresetId ?? 'case1');
  const [detail, setDetail] = useState(null);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [report, setReport] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [runError, setRunError] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [restored, setRestored] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    api.presets().then((p) => setPresets(p.presets)).catch((e) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    if (initialPresetId) setPresetId(initialPresetId);
  }, [initialPresetId]);

  const loadDetail = useCallback(async (id) => {
    setDetail(null);
    setReport(null);
    setRestored(false);
    setRunError(null);
    try {
      const d = await api.preset(id);
      setDetail(d);
      setSelectedOptionId(d.submission.selected_option_id ?? d.questions[0]?.options[0]?.id ?? null);
    } catch (e) {
      setLoadError(e.message);
    }
  }, []);

  useEffect(() => {
    if (presetId) loadDetail(presetId);
  }, [presetId, loadDetail]);

  const pickPreset = useCallback((id) => {
    setPresetId(id);
    if (onExternalPreset) onExternalPreset(id);
  }, [onExternalPreset]);

  const run = useCallback(async () => {
    if (!detail || analyzing) return;
    setAnalyzing(true);
    setRunError(null);
    setRestored(false);
    const submission =
      detail.submission.mode === 'session'
        ? detail.submission
        : detail.submission.mode === 'free_text'
          ? { mode: 'free_text', question_id: detail.submission.question_id, working_text: detail.submission.working_text }
          : { mode: 'mcq', question_id: detail.submission.question_id, selected_option_id: selectedOptionId, working_text: detail.submission.working_text };
    try {
      // Staged reveal: the engine is instant; the shimmer walks the pipeline.
      const [result] = await Promise.all([
        api.analyze({ student_id: detail.student.student_id, commit: true, submission }),
        new Promise((r) => setTimeout(r, DEMO_DELAY_MS)),
      ]);
      setReport(result);
    } catch (e) {
      setRunError(e.message);
    } finally {
      setAnalyzing(false);
    }
  }, [detail, selectedOptionId, analyzing]);

  const reset = useCallback(async () => {
    setResetting(true);
    try {
      await api.reset();
      await loadDetail(presetId);
    } catch (e) {
      setRunError(e.message);
    } finally {
      setResetting(false);
    }
  }, [presetId, loadDetail]);

  const handleBridge = useCallback((bridgeResult) => {
    if (bridgeResult.correct) {
      setReport((prev) => prev && ({
        ...prev,
        node_states: bridgeResult.node_states,
        roadmap_action: 'CONTINUE',
        root_prerequisite_blocked: null,
        roadmap: [{ step: 1, node: prev.root_prerequisite_blocked ?? 'scalar_variables', action: 'CONTINUE', title: 'Prerequisite restored — roadmap resumed' }],
      }));
      setRestored(true);
    }
  }, []);

  if (loadError && presets.length === 0) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200" role="alert">
        Could not reach the API. Is the server running on :8787? ({loadError})
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PresetBar presets={presets} selectedId={presetId} onSelect={pickPreset} onReset={reset} resetting={resetting} />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        <SubmissionPanel
          detail={detail}
          selectedOptionId={selectedOptionId}
          onPickOption={setSelectedOptionId}
          onRun={run}
          analyzing={analyzing}
          runError={runError}
        />
        <DiagnosticReport report={report} preset={detail} restored={restored} onBridge={handleBridge} />
      </div>
    </div>
  );
}
