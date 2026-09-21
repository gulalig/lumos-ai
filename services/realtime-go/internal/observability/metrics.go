package observability

import (
	"net/http"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const (
	metricsNamespace = "lumos"
	metricsSubsystem = "realtime"
)

type Metrics struct {
	registry *prometheus.Registry

	pendingMu sync.Mutex

	evidencePendingByMeeting map[string]int64

	lagMu sync.Mutex

	evidenceGroupLagByMeeting map[string]int64

	microphoneMu sync.Mutex

	activeMicrophoneTracksByMeeting map[string]int

	activeMeetings         prometheus.Gauge
	activeMicrophoneTracks prometheus.Gauge
	evidenceQueueDepth     prometheus.Gauge
	evidencePending        prometheus.Gauge
	evidenceGroupLag       prometheus.Gauge

	evidenceQueueBackpressure prometheus.Counter

	evidenceProcessingDuration prometheus.Histogram
	semanticExtractionDuration prometheus.Histogram
	redisCommitDuration        prometheus.Histogram
	leaseTakeoverDuration      prometheus.Histogram

	failures *prometheus.CounterVec

	deadLetters       prometheus.Counter
	leaseLosses       prometheus.Counter
	capacityDeferrals prometheus.Counter
}

func NewMetrics() *Metrics {
	registry :=
		prometheus.NewRegistry()

	activeMeetings :=
		prometheus.NewGauge(
			prometheus.GaugeOpts{
				Namespace: metricsNamespace,

				Subsystem: metricsSubsystem,

				Name: "active_meetings",

				Help: "Number of meeting runtimes currently active on this realtime instance.",
			},
		)

	activeMicrophoneTracks :=
		prometheus.NewGauge(
			prometheus.GaugeOpts{
				Namespace: metricsNamespace,

				Subsystem: metricsSubsystem,

				Name: "active_microphone_tracks",

				Help: "Number of microphone tracks currently being processed.",
			},
		)

	evidenceQueueDepth :=
		prometheus.NewGauge(
			prometheus.GaugeOpts{
				Namespace: metricsNamespace,

				Subsystem: metricsSubsystem,

				Name: "evidence_queue_depth",

				Help: "Current number of accepted evidence turns waiting in the local dispatcher queue.",
			},
		)

	evidenceQueueBackpressure :=
		prometheus.NewCounter(
			prometheus.CounterOpts{
				Namespace: metricsNamespace,

				Subsystem: metricsSubsystem,

				Name: "evidence_queue_backpressure_total",

				Help: "Number of evidence enqueue attempts that encountered a full local dispatcher queue.",
			},
		)

	evidencePending :=
		prometheus.NewGauge(
			prometheus.GaugeOpts{
				Namespace: metricsNamespace,

				Subsystem: metricsSubsystem,

				Name: "evidence_pending",

				Help: "Current number of evidence stream entries pending processing.",
			},
		)

	evidenceGroupLag :=
		prometheus.NewGauge(
			prometheus.GaugeOpts{
				Namespace: metricsNamespace,

				Subsystem: metricsSubsystem,

				Name: "evidence_group_lag",

				Help: "Last successfully observed number of evidence stream entries not yet delivered to locally-owned meeting consumer groups.",
			},
		)

	evidenceProcessingDuration :=
		prometheus.NewHistogram(
			prometheus.HistogramOpts{
				Namespace: metricsNamespace,

				Subsystem: metricsSubsystem,

				Name: "evidence_processing_seconds",

				Help: "End-to-end duration of one durable evidence processing attempt.",

				Buckets: []float64{
					0.005,
					0.01,
					0.025,
					0.05,
					0.1,
					0.25,
					0.5,
					1,
					2.5,
					5,
					10,
				},
			},
		)

	semanticExtractionDuration :=
		prometheus.NewHistogram(
			prometheus.HistogramOpts{
				Namespace: metricsNamespace,

				Subsystem: metricsSubsystem,

				Name: "semantic_extraction_seconds",

				Help: "Duration of semantic extraction for one evidence turn.",

				Buckets: []float64{
					0.05,
					0.1,
					0.25,
					0.5,
					1,
					2,
					4,
					8,
					10,
				},
			},
		)

	redisCommitDuration :=
		prometheus.NewHistogram(
			prometheus.HistogramOpts{
				Namespace: metricsNamespace,

				Subsystem: metricsSubsystem,

				Name: "redis_commit_seconds",

				Help: "Duration of durable fenced Redis commit operations.",

				Buckets: []float64{
					0.001,
					0.0025,
					0.005,
					0.01,
					0.025,
					0.05,
					0.1,
					0.25,
					0.5,
					1,
					2.5,
				},
			},
		)

	leaseTakeoverDuration :=
		prometheus.NewHistogram(
			prometheus.HistogramOpts{
				Namespace: metricsNamespace,

				Subsystem: metricsSubsystem,

				Name: "lease_takeover_seconds",

				Help: "Time from this realtime instance first observing a desired meeting owned elsewhere until this instance successfully acquires that meeting lease.",

				Buckets: []float64{
					0.05,
					0.1,
					0.25,
					0.5,
					1,
					2,
					5,
					10,
					15,
					30,
				},
			},
		)

	failures :=
		prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: metricsNamespace,

				Subsystem: metricsSubsystem,

				Name: "failures_total",

				Help: "Count of realtime processing failures by bounded component and reason.",
			},
			[]string{
				"component",
				"reason",
			},
		)

	deadLetters :=
		prometheus.NewCounter(
			prometheus.CounterOpts{
				Namespace: metricsNamespace,

				Subsystem: metricsSubsystem,

				Name: "dead_letters_total",

				Help: "Number of evidence messages moved to the dead-letter stream.",
			},
		)

	leaseLosses :=
		prometheus.NewCounter(
			prometheus.CounterOpts{
				Namespace: metricsNamespace,

				Subsystem: metricsSubsystem,

				Name: "lease_losses_total",

				Help: "Number of meeting runtime ownership losses detected by this instance.",
			},
		)

	capacityDeferrals :=
		prometheus.NewCounter(
			prometheus.CounterOpts{
				Namespace: metricsNamespace,

				Subsystem: metricsSubsystem,

				Name: "capacity_deferrals_total",

				Help: "Number of meeting runtime starts deferred because local instance capacity was full.",
			},
		)

	registry.MustRegister(
		collectors.NewGoCollector(),
		collectors.NewProcessCollector(
			collectors.ProcessCollectorOpts{},
		),

		activeMeetings,
		activeMicrophoneTracks,
		evidenceQueueDepth,
		evidencePending,
		evidenceGroupLag,

		evidenceQueueBackpressure,

		evidenceProcessingDuration,
		semanticExtractionDuration,
		redisCommitDuration,
		leaseTakeoverDuration,

		failures,

		deadLetters,
		leaseLosses,
		capacityDeferrals,
	)

	return &Metrics{
		registry: registry,

		evidencePendingByMeeting: make(map[string]int64),

		activeMeetings: activeMeetings,

		activeMicrophoneTracks: activeMicrophoneTracks,

		evidenceQueueDepth: evidenceQueueDepth,

		evidencePending: evidencePending,

		evidenceGroupLagByMeeting: make(map[string]int64),

		evidenceGroupLag: evidenceGroupLag,

		activeMicrophoneTracksByMeeting: make(map[string]int),

		evidenceQueueBackpressure: evidenceQueueBackpressure,

		evidenceProcessingDuration: evidenceProcessingDuration,

		semanticExtractionDuration: semanticExtractionDuration,

		redisCommitDuration: redisCommitDuration,

		leaseTakeoverDuration: leaseTakeoverDuration,

		failures: failures,

		deadLetters: deadLetters,

		leaseLosses: leaseLosses,

		capacityDeferrals: capacityDeferrals,
	}
}

func (
	m *Metrics,
) Handler() http.Handler {
	return promhttp.HandlerFor(
		m.registry,
		promhttp.HandlerOpts{
			EnableOpenMetrics: true,
		},
	)
}

func (
	m *Metrics,
) SetActiveMeetings(
	count int,
) {
	m.activeMeetings.Set(
		float64(
			count,
		),
	)
}

func (
	m *Metrics,
) SetActiveMicrophoneTracks(
	count int,
) {
	m.activeMicrophoneTracks.Set(
		float64(
			count,
		),
	)
}

func (
	m *Metrics,
) SetMeetingActiveMicrophoneTracks(
	meetingID string,
	count int,
) {
	if meetingID == "" {
		return
	}

	if count < 0 {
		count = 0
	}

	m.microphoneMu.Lock()
	defer m.microphoneMu.Unlock()

	if count == 0 {
		delete(
			m.activeMicrophoneTracksByMeeting,
			meetingID,
		)
	} else {
		m.activeMicrophoneTracksByMeeting[meetingID] = count
	}

	m.updateActiveMicrophoneTracksGaugeLocked()
}

func (
	m *Metrics,
) RemoveMeetingActiveMicrophoneTracks(
	meetingID string,
) {
	if meetingID == "" {
		return
	}

	m.microphoneMu.Lock()
	defer m.microphoneMu.Unlock()

	delete(
		m.activeMicrophoneTracksByMeeting,
		meetingID,
	)

	m.updateActiveMicrophoneTracksGaugeLocked()
}

func (
	m *Metrics,
) updateActiveMicrophoneTracksGaugeLocked() {
	total := 0

	for _, count := range m.activeMicrophoneTracksByMeeting {

		if count <= 0 {
			continue
		}

		total += count
	}

	m.activeMicrophoneTracks.Set(
		float64(
			total,
		),
	)
}

func (
	m *Metrics,
) SetMeetingEvidenceGroupLag(
	meetingID string,
	lag int64,
) {
	if meetingID == "" ||
		lag < 0 {

		return
	}

	m.lagMu.Lock()
	defer m.lagMu.Unlock()

	m.evidenceGroupLagByMeeting[meetingID] = lag

	m.updateEvidenceGroupLagGaugeLocked()
}

func (
	m *Metrics,
) RemoveMeetingEvidenceGroupLag(
	meetingID string,
) {
	if meetingID == "" {
		return
	}

	m.lagMu.Lock()
	defer m.lagMu.Unlock()

	delete(
		m.evidenceGroupLagByMeeting,
		meetingID,
	)

	m.updateEvidenceGroupLagGaugeLocked()
}

func (
	m *Metrics,
) updateEvidenceGroupLagGaugeLocked() {
	var total int64

	for _, lag := range m.evidenceGroupLagByMeeting {

		if lag <= 0 {
			continue
		}

		total += lag
	}

	m.evidenceGroupLag.Set(
		float64(
			total,
		),
	)
}

func (
	m *Metrics,
) SetEvidenceQueueDepth(
	count int,
) {
	m.evidenceQueueDepth.Set(
		float64(
			count,
		),
	)
}

func (
	m *Metrics,
) AddEvidenceQueueDepth(
	delta int,
) {
	if delta == 0 {
		return
	}

	m.evidenceQueueDepth.Add(
		float64(
			delta,
		),
	)
}

func (
	m *Metrics,
) IncEvidenceQueueBackpressure() {
	m.evidenceQueueBackpressure.Inc()
}

func (
	m *Metrics,
) SetEvidencePending(
	count int64,
) {
	m.evidencePending.Set(
		float64(
			count,
		),
	)
}

func (
	m *Metrics,
) SetMeetingEvidencePending(
	meetingID string,
	count int64,
) {
	if meetingID == "" {
		return
	}

	if count < 0 {
		count = 0
	}

	m.pendingMu.Lock()
	defer m.pendingMu.Unlock()

	m.evidencePendingByMeeting[meetingID] = count

	m.updateEvidencePendingGaugeLocked()
}

func (
	m *Metrics,
) AddMeetingEvidencePending(
	meetingID string,
	delta int64,
) {
	if meetingID == "" ||
		delta == 0 {

		return
	}

	m.pendingMu.Lock()
	defer m.pendingMu.Unlock()

	next := max(m.evidencePendingByMeeting[meetingID]+delta, 0)

	m.evidencePendingByMeeting[meetingID] = next

	m.updateEvidencePendingGaugeLocked()
}

func (
	m *Metrics,
) RemoveMeetingEvidencePending(
	meetingID string,
) {
	if meetingID == "" {
		return
	}

	m.pendingMu.Lock()
	defer m.pendingMu.Unlock()

	delete(
		m.evidencePendingByMeeting,
		meetingID,
	)

	m.updateEvidencePendingGaugeLocked()
}

func (
	m *Metrics,
) updateEvidencePendingGaugeLocked() {
	var total int64

	for _, count := range m.evidencePendingByMeeting {

		total += count
	}

	m.evidencePending.Set(
		float64(
			total,
		),
	)
}

func (
	m *Metrics,
) ObserveEvidenceProcessing(
	duration time.Duration,
) {
	m.evidenceProcessingDuration.Observe(
		duration.Seconds(),
	)
}

func (
	m *Metrics,
) ObserveSemanticExtraction(
	duration time.Duration,
) {
	m.semanticExtractionDuration.Observe(
		duration.Seconds(),
	)
}

func (
	m *Metrics,
) ObserveRedisCommit(
	duration time.Duration,
) {
	m.redisCommitDuration.Observe(
		duration.Seconds(),
	)
}

func (
	m *Metrics,
) ObserveLeaseTakeover(
	duration time.Duration,
) {
	m.leaseTakeoverDuration.Observe(
		duration.Seconds(),
	)
}

func (
	m *Metrics,
) IncFailure(
	component string,
	reason string,
) {
	m.failures.WithLabelValues(
		component,
		reason,
	).Inc()
}

func (
	m *Metrics,
) IncDeadLetter() {
	m.deadLetters.Inc()
}

func (
	m *Metrics,
) IncLeaseLoss() {
	m.leaseLosses.Inc()
}

func (
	m *Metrics,
) IncCapacityDeferral() {
	m.capacityDeferrals.Inc()
}
