package meetingsupervisor

const maxConcurrentMeetingRuntimes = 8

func (
	s *Supervisor,
) tryReserveRuntimeSlot() bool {
	select {
	case s.runtimeSlots <- struct{}{}:

		return true

	default:
		return false
	}
}

func (
	s *Supervisor,
) releaseRuntimeSlot() {
	select {
	case <-s.runtimeSlots:

	default:
		s.logger.Error(
			"meeting runtime capacity slot release without reservation",
			"instanceId",
			s.instanceID,
		)
	}
}
