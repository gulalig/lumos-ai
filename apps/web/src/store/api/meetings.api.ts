import type {
  MeetingDetailResponse,
  MeetingListItem,
} from "@/features/meetings/meetings.types";

import { baseApi } from "./base-api";

export const meetingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMeetings: builder.query<MeetingListItem[], void>({
      query: () => ({
        url: "/meetings",
        method: "GET",
      }),
    }),

    getMeetingDetail: builder.query<MeetingDetailResponse, string>({
      // The API exposes these three resources, not a /detail endpoint.
      // Fetch the meeting first so its actual HTTP status controls stale-URL UX.
      async queryFn(meetingId, _api, _options, baseQuery) {
        const path = `/meetings/${encodeURIComponent(meetingId)}`;
        const meeting = await baseQuery({ url: path, method: "GET" });
        if (meeting.error) return { error: meeting.error };
        const [snapshot, interventions] = await Promise.all([
          baseQuery({ url: path + "/snapshot", method: "GET" }),
          baseQuery({ url: path + "/interventions", method: "GET" }),
        ]);
        if (snapshot.error) return { error: snapshot.error };
        if (interventions.error) return { error: interventions.error };
        return {
          data: {
            meeting: meeting.data as MeetingDetailResponse["meeting"],
            snapshot: snapshot.data as MeetingDetailResponse["snapshot"],
            interventions:
              interventions.data as MeetingDetailResponse["interventions"],
          },
        };
      },
    }),
  }),
});

export const { useGetMeetingsQuery, useGetMeetingDetailQuery } = meetingsApi;
