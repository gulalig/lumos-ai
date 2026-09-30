// @vitest-environment jsdom
import { configureStore } from "@reduxjs/toolkit";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Provider } from "react-redux";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "@/theme/theme";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { meetingsApi } from "@/store/api/meetings.api";
import { MeetingDetailView } from "./MeetingDetailView";

const { replace, router } = vi.hoisted(() => {
  const replace = vi.fn();
  return { replace, router: { replace } };
});
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useParams: () => ({ meetingId: "deleted-meeting" }),
}));
vi.mock("@mui/icons-material", () => ({
  ArrowBackRounded: () => null,
  AssignmentTurnedInOutlined: () => null,
  BoltRounded: () => null,
  CalendarTodayOutlined: () => null,
  CheckCircleOutlineRounded: () => null,
  HelpOutlineRounded: () => null,
  LightbulbOutlined: () => null,
  PersonOutlineRounded: () => null,
  QuestionAnswerOutlined: () => null,
  ScheduleRounded: () => null,
  WarningAmberRounded: () => null,
}));

const fetchMock = vi.fn<typeof fetch>();
const stores: ReturnType<typeof createStore>[] = [];
function createStore() {
  return configureStore({
    reducer: {
      [meetingsApi.reducerPath]: meetingsApi.reducer,
      auth: () => ({ accessToken: "test-token" }),
    },
    middleware: (defaults) => defaults().concat(meetingsApi.middleware),
  });
}
function mount() {
  const store = createStore();
  stores.push(store);
  return render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <MeetingDetailView />
      </ThemeProvider>
    </Provider>,
  );
}
function response(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
beforeEach(() => {
  replace.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  stores
    .splice(0)
    .forEach((store) => store.dispatch(meetingsApi.util.resetApiState()));
  vi.unstubAllGlobals();
});

describe("meeting detail HTTP error handling", () => {
  it("redirects on the actual 404 status without displaying the generic error", async () => {
    fetchMock.mockResolvedValue(
      response(404, { message: "Any server message" }),
    );
    mount();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app/meetings"));
    expect(screen.queryByText("Unable to load meeting details.")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][0] as Request).url).toMatch(
      /\/meetings\/deleted-meeting$/,
    );
  });

  it("keeps the existing error and Retry for HTTP 500, even with a not-found message", async () => {
    fetchMock.mockImplementation(async () =>
      response(500, { message: "Meeting not found" }),
    );
    mount();
    expect(
      await screen.findByText("Unable to load meeting details."),
    ).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(replace).not.toHaveBeenCalled();
  });

  it("keeps the existing error and Retry for network failures", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    mount();
    expect(
      await screen.findByText("Unable to load meeting details."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("loads real meeting, snapshot and intervention resources for an existing meeting", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = (input as Request).url;
      if (url.endsWith("/snapshot"))
        return response(200, {
          meetingId: "deleted-meeting",
          status: "ended",
          version: 1,
          commitments: [],
          decisions: [],
          questions: [],
          proposals: [],
        });
      if (url.endsWith("/interventions")) return response(200, []);
      return response(200, {
        id: "deleted-meeting",
        roomName: "Actual meeting",
        status: "ended",
        workspaceId: null,
        createdAt: "2026-09-30T10:00:00Z",
        startedAt: null,
        endedAt: null,
      });
    });
    mount();
    expect(
      await screen.findByRole("heading", { name: "Actual meeting" }),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      fetchMock.mock.calls
        .map(([input]) => (input as Request).url)
        .some((url) => url.endsWith("/detail")),
    ).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });
});
