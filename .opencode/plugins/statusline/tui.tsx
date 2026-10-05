/** @jsxImportSource @opentui/solid */
// OpenCode status line (ported from ~/.claude/statusline-command.sh)
//
// Renders the Claude Code status line block just above the prompt, plus a
// cache line (hit rate and cached tokens; OpenCode has no cache TTL or miss
// data). Rate limits (OpenCode has none) and the directory/branch line are left
// out: v2.0.20 can't resolve projects under ~/Documents
// (anomalyco/opencode#52458), so it reports the wrong location. Auto-discovered
// from `.opencode/plugins/statusline/tui.tsx` (project) or
// `~/.config/opencode/plugins/statusline/tui.tsx` (global).
import { Plugin } from '@opencode/plugin/tui';
import { Show, createMemo } from 'solid-js';

const BAR_WIDTH = 10;

function formatTokens(n: number) {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
	return String(n);
}

function formatDuration(ms: number) {
	const s = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

function StatusLine(props: { context: Plugin.Context; sessionID: string }) {
	const { context } = props;
	const theme = () => context.theme;
	const location = () => context.location;

	const stats = createMemo(() => {
		const session = context.data.session.get(props.sessionID);
		const last = context.data.session.message
			.list(props.sessionID)
			.findLast((m) => m.type === 'assistant');
		const assistant = last?.type === 'assistant' ? last : undefined;

		// Before the first response, fall back to the prompt's selected model
		const ref = assistant?.model ?? session?.model ?? context.ui.model.current();
		const refID = ref && ('id' in ref ? ref.id : ref.modelID);
		const model = ref
			? context.data.location.model
					.list(location())
					?.find((m) => m.providerID === ref.providerID && (m.id === refID || m.modelID === refID))
			: undefined;

		// Live context = the latest response's total tokens
		const t = assistant?.tokens;
		const ctxUsed = t ? t.input + t.output + t.reasoning + t.cache.read + t.cache.write : 0;
		const ctxLimit = model?.limit.context ?? 0;
		const pct = ctxLimit > 0 ? Math.min(100, Math.round((ctxUsed * 100) / ctxLimit)) : 0;

		const s = session?.tokens;
		// Session totals only: OpenCode has no cache TTL, warm/cold state or miss count
		const cacheTotal = s ? s.input + s.cache.read + s.cache.write : 0;
		return {
			model: model?.name ?? refID,
			variant: ref?.variant,
			pct,
			input: s ? s.input + s.cache.read + s.cache.write : 0,
			output: s ? s.output + s.reasoning : 0,
			cached: s?.cache.read ?? 0,
			hit: cacheTotal > 0 ? Math.round(((s?.cache.read ?? 0) * 100) / cacheTotal) : undefined,
			cost: session?.cost ?? 0,
			// v2 only bumps session.time.updated on metadata changes, so use the latest response
			duration: session
				? (assistant?.time.completed ?? assistant?.time.created ?? session.time.idle ?? session.time.updated) -
					session.time.created
				: 0,
		};
	});

	// Same palette as the Claude Code script: green/yellow/red, cyan, magenta, dim
	const green = () => theme().text.feedback.success.base;
	const yellow = () => theme().text.feedback.warning.base;
	const red = () => theme().text.feedback.error.base;
	const cyan = () => theme().text.feedback.info.base;
	// No theme token is magenta in every theme, so use the classic terminal magenta
	const magenta = () => '#c678dd';
	const dim = () => theme().text.muted;

	const barColor = () => (stats().pct >= 80 ? red() : stats().pct >= 50 ? yellow() : green());
	// Higher is better for cache hits, so the scale runs the other way
	const hitColor = () => {
		const hit = stats().hit ?? 0;
		return hit >= 80 ? green() : hit >= 50 ? yellow() : red();
	};
	const bar = () => {
		const filled = Math.round(stats().pct / BAR_WIDTH);
		return '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);
	};
	const sep = () => <span style={{ fg: dim() }}>{'  |  '}</span>;

	return (
		<box flexDirection="column" paddingBottom={1}>
			<text wrapMode="none">
				<span style={{ fg: cyan() }}>
					<b>[{stats().model ?? 'no model'}]</b>
				</span>
				<Show when={stats().variant}>
					{sep()}🧠 <span style={{ fg: magenta() }}>{stats().variant}</span>
				</Show>
			</text>
			<text wrapMode="none">
				<span style={{ fg: barColor() }}>{bar()}</span>
				<span style={{ fg: yellow() }}> {stats().pct}%</span>
				{sep()}
				<span style={{ fg: cyan() }}>
					{formatTokens(stats().input)} ↑ / {formatTokens(stats().output)} ↓
				</span>
			</text>
			<text wrapMode="none">
				<span style={{ fg: green() }}>${stats().cost.toFixed(2)}</span>
				{sep()}🕐 {formatDuration(stats().duration)}
			</text>
			<Show when={stats().hit !== undefined} fallback={<text style={{ fg: dim() }}>💾 cache --</text>}>
				<text wrapMode="none">
					💾 cache hit <span style={{ fg: hitColor() }}>{stats().hit}%</span>
					{sep()}
					<span style={{ fg: cyan() }}>{formatTokens(stats().cached)} cached</span>
				</text>
			</Show>
		</box>
	);
}

export default Plugin.define({
	id: 'statusline',
	setup(context) {
		return context.ui.slot({
			append: 'session.composer.top',
			render: (input) => <StatusLine context={context} sessionID={input.sessionID} />,
		});
	},
});
