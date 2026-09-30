"use client";

import { CalendarMonthRounded, CloseRounded } from "@mui/icons-material";
import {
  Box,
  Button,
  IconButton,
  MenuItem,
  Popover,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { DayPicker, type Matcher } from "@daypicker/react";
import { useMemo, useRef, useState } from "react";

export interface AppDateTimePickerProps {
  label: string;

  value: Date | null;

  onChange: (value: Date | null) => void;

  disabled?: boolean;

  disablePast?: boolean;

  minDate?: Date;

  maxDate?: Date;

  error?: boolean;

  helperText?: string;

  placeholder?: string;

  clearable?: boolean;
}

const BRAND = "#C89B5B";

const BRAND_DARK = "#A9793C";

const BRAND_SOFT = "#F7F0E6";

const PickerField = styled(TextField)(({ theme }) => ({
  "& .MuiOutlinedInput-root": {
    minHeight: 44,

    borderRadius: 12,

    backgroundColor: theme.palette.background.paper,

    "& fieldset": {
      borderColor: theme.palette.divider,
    },

    "&:hover fieldset": {
      borderColor: "#D7B27A",
    },

    "&.Mui-focused fieldset": {
      borderColor: BRAND,

      borderWidth: 1,
    },
  },

  "& .MuiInputLabel-root.Mui-focused": {
    color: BRAND_DARK,
  },

  "& .MuiInputBase-input": {
    cursor: "pointer",
  },
}));

const PickerInputButton = styled(IconButton)(({ theme }) => ({
  color: theme.palette.text.secondary,

  "&:hover": {
    color: BRAND_DARK,

    backgroundColor: BRAND_SOFT,
  },
}));

const PickerSurface = styled(Box)(({ theme }) => ({
  width: 620,

  maxWidth: "calc(100vw - 32px)",

  border: `1px solid ${theme.palette.divider}`,

  borderRadius: 16,

  backgroundColor: theme.palette.background.paper,

  boxShadow: "0 22px 60px rgba(24, 24, 27, 0.16)",

  overflow: "hidden",

  [theme.breakpoints.down("sm")]: {
    width: "calc(100vw - 24px)",
  },
}));

const PickerBody = styled(Box)(({ theme }) => ({
  display: "grid",

  gridTemplateColumns: "minmax(0, 1fr) 190px",

  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
  },
}));

const CalendarSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2.25),

  borderRight: `1px solid ${theme.palette.divider}`,

  [theme.breakpoints.down("sm")]: {
    borderRight: 0,

    borderBottom: `1px solid ${theme.palette.divider}`,
  },

  "& .lumos-rdp-root": {
    width: "100%",
  },

  "& .lumos-rdp-months": {
    width: "100%",
  },

  "& .lumos-rdp-month": {
    width: "100%",
  },

  "& .lumos-rdp-month-caption": {
    display: "flex",

    alignItems: "center",

    minHeight: 38,

    marginBottom: theme.spacing(1.5),

    paddingInline: theme.spacing(0.5),
  },

  "& .lumos-rdp-caption-label": {
    color: theme.palette.text.primary,

    fontSize: 14,

    fontWeight: 700,

    letterSpacing: "-0.01em",
  },

  "& .lumos-rdp-nav": {
    position: "absolute",

    top: 17,

    right: 17,

    display: "flex",

    gap: theme.spacing(0.5),
  },

  "& .lumos-rdp-previous, & .lumos-rdp-next": {
    display: "grid",

    placeItems: "center",

    width: 32,

    height: 32,

    padding: 0,

    border: `1px solid ${theme.palette.divider}`,

    borderRadius: 9,

    backgroundColor: theme.palette.background.paper,

    color: theme.palette.text.secondary,

    cursor: "pointer",

    transition: theme.transitions.create([
      "background-color",
      "color",
      "border-color",
    ]),

    "&:hover": {
      borderColor: "#D7B27A",

      backgroundColor: BRAND_SOFT,

      color: BRAND_DARK,
    },

    "&:disabled": {
      cursor: "default",

      opacity: 0.35,
    },
  },

  "& .lumos-rdp-chevron": {
    width: 16,

    height: 16,

    fill: "currentColor",
  },

  "& .lumos-rdp-month-grid": {
    width: "100%",

    borderCollapse: "separate",

    borderSpacing: "3px",
  },

  "& .lumos-rdp-weekdays": {
    height: 32,
  },

  "& .lumos-rdp-weekday": {
    color: theme.palette.text.secondary,

    fontSize: 11,

    fontWeight: 650,

    textAlign: "center",
  },

  "& .lumos-rdp-day": {
    padding: 0,

    textAlign: "center",
  },

  "& .lumos-rdp-day-button": {
    display: "inline-grid",

    placeItems: "center",

    width: 36,

    height: 36,

    padding: 0,

    border: 0,

    borderRadius: 10,

    background: "transparent",

    color: theme.palette.text.primary,

    font: "inherit",

    fontSize: 13,

    fontWeight: 500,

    cursor: "pointer",

    transition: theme.transitions.create(["background-color", "color"]),

    "&:hover": {
      backgroundColor: BRAND_SOFT,

      color: BRAND_DARK,
    },

    "&:focus-visible": {
      outline: `2px solid ${BRAND}`,

      outlineOffset: 1,
    },
  },

  "& .lumos-rdp-selected .lumos-rdp-day-button": {
    backgroundColor: BRAND,

    color: "#FFFFFF",

    fontWeight: 700,

    "&:hover": {
      backgroundColor: BRAND_DARK,

      color: "#FFFFFF",
    },
  },

  "& .lumos-rdp-today:not(.lumos-rdp-selected) .lumos-rdp-day-button": {
    boxShadow: `inset 0 0 0 1px ${BRAND}`,

    color: BRAND_DARK,

    fontWeight: 700,
  },

  "& .lumos-rdp-outside .lumos-rdp-day-button": {
    color: theme.palette.text.disabled,
  },

  "& .lumos-rdp-disabled .lumos-rdp-day-button": {
    cursor: "not-allowed",

    color: theme.palette.text.disabled,

    opacity: 0.45,

    "&:hover": {
      background: "transparent",
    },
  },
}));

const TimeSection = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  padding: theme.spacing(2.25),
  backgroundColor: "#FCFCFC",

  "& .lumos-time-menu .MuiPaper-root": {
    maxHeight: 240,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 10,
    boxShadow: "0 12px 30px rgba(24, 24, 27, 0.12)",
  },

  "& .lumos-time-menu .MuiMenu-list": {
    paddingTop: 4,
    paddingBottom: 4,
  },

  "& .lumos-time-menu .MuiMenuItem-root": {
    minHeight: 36,
    fontSize: 14,
  },

  "& .lumos-time-menu .MuiMenuItem-root.Mui-selected": {
    backgroundColor: BRAND_SOFT,
    color: BRAND_DARK,
    fontWeight: 700,
  },

  "& .lumos-time-menu .MuiMenuItem-root.Mui-selected:hover": {
    backgroundColor: BRAND_SOFT,
  },
}));

const TimeTitle = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(1.5),

  color: theme.palette.text.primary,

  fontSize: 13,

  fontWeight: 700,
}));

const TimeFields = styled(Box)(({ theme }) => ({
  display: "grid",

  gridTemplateColumns: "1fr 1fr",

  gap: theme.spacing(1),
}));

const TimeSelect = styled(Select)(({ theme }) => ({
  height: 42,

  borderRadius: 10,

  backgroundColor: theme.palette.background.paper,

  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: theme.palette.divider,
  },

  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "#D7B27A",
  },

  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: BRAND,

    borderWidth: 1,
  },
}));

const TimeLabel = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(0.6),

  color: theme.palette.text.secondary,

  fontSize: 10,

  fontWeight: 650,

  textTransform: "uppercase",

  letterSpacing: "0.06em",
}));

const TimeColumn = styled(Box)({
  minWidth: 0,
});

const SelectedPreview = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),

  padding: theme.spacing(1.25, 1.4),

  border: `1px solid ${theme.palette.divider}`,

  borderRadius: 10,

  backgroundColor: theme.palette.background.paper,
}));

const PreviewLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,

  fontSize: 10,

  fontWeight: 600,
}));

const PreviewValue = styled(Typography)(({ theme }) => ({
  marginTop: 3,

  color: theme.palette.text.primary,

  fontSize: 12,

  fontWeight: 650,
}));

const PickerFooter = styled(Box)(({ theme }) => ({
  display: "flex",

  alignItems: "center",

  justifyContent: "space-between",

  gap: theme.spacing(2),

  minHeight: 64,

  padding: theme.spacing(1.25, 2),

  borderTop: `1px solid ${theme.palette.divider}`,
}));

const FooterLeft = styled(Box)(({ theme }) => ({
  display: "flex",

  gap: theme.spacing(0.5),
}));

const FooterRight = styled(Box)(({ theme }) => ({
  display: "flex",

  gap: theme.spacing(1),
}));

const SubtleButton = styled(Button)(({ theme }) => ({
  minHeight: 38,

  borderRadius: 10,

  color: theme.palette.text.secondary,

  textTransform: "none",

  fontWeight: 600,

  "&:hover": {
    backgroundColor: "#F5F5F5",

    color: theme.palette.text.primary,
  },
}));

const BrandButton = styled(Button)({
  minHeight: 38,

  paddingInline: 18,

  borderRadius: 10,

  backgroundColor: BRAND,

  color: "#FFFFFF",

  textTransform: "none",

  fontWeight: 700,

  boxShadow: "none",

  "&:hover": {
    backgroundColor: BRAND_DARK,

    boxShadow: "none",
  },

  "&.Mui-disabled": {
    backgroundColor: "#E8E1D8",

    color: "#9A948D",
  },
});

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function mergeDateAndTime(date: Date, hours: number, minutes: number): Date {
  const next = new Date(date);

  next.setHours(hours, minutes, 0, 0);

  return next;
}

function formatDateTime(value: Date): string {
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",

    month: "2-digit",

    year: "numeric",
  }).format(value);

  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",

    minute: "2-digit",

    hour12: false,
  }).format(value);

  return `${date} ${time}`;
}

function formatPreview(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",

    month: "short",

    year: "numeric",

    hour: "2-digit",

    minute: "2-digit",

    hour12: false,
  }).format(value);
}

function createNumberRange(length: number): number[] {
  return Array.from(
    {
      length,
    },
    (_, index) => index,
  );
}

export function AppDateTimePicker({
  label,
  value,
  onChange,
  disabled = false,
  disablePast = false,
  minDate,
  maxDate,
  error = false,
  helperText,
  placeholder = "dd/mm/yyyy --:--",
  clearable = true,
}: AppDateTimePickerProps) {
  const fieldRef = useRef<HTMLDivElement | null>(null);

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const [draftValue, setDraftValue] = useState<Date | null>(value);

  const hours = useMemo(() => createNumberRange(24), []);

  const minutes = useMemo(() => createNumberRange(60), []);

  const open = Boolean(anchorEl);

  const selectedHours = draftValue?.getHours() ?? 9;

  const selectedMinutes = draftValue?.getMinutes() ?? 0;

  const disabledDays = useMemo(() => {
    const matchers: Matcher[] = [];

    if (disablePast) {
      matchers.push({
        before: startOfDay(new Date()),
      });
    }

    if (minDate) {
      matchers.push({
        before: startOfDay(minDate),
      });
    }

    if (maxDate) {
      matchers.push({
        after: startOfDay(maxDate),
      });
    }

    return matchers;
  }, [disablePast, minDate, maxDate]);

  const openPicker = () => {
    if (!fieldRef.current) {
      return;
    }

    setDraftValue(value);

    setAnchorEl(fieldRef.current);
  };

  const closePicker = () => {
    setAnchorEl(null);

    setDraftValue(value);
  };

  const handleFieldClick = () => {
    if (disabled) {
      return;
    }

    openPicker();
  };

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) {
      return;
    }

    setDraftValue(mergeDateAndTime(day, selectedHours, selectedMinutes));
  };

  const handleHourChange = (hoursValue: number) => {
    const date = draftValue ?? new Date();

    setDraftValue(mergeDateAndTime(date, hoursValue, selectedMinutes));
  };

  const handleMinuteChange = (minutesValue: number) => {
    const date = draftValue ?? new Date();

    setDraftValue(mergeDateAndTime(date, selectedHours, minutesValue));
  };

  const handleToday = () => {
    const today = new Date();

    setDraftValue(
      mergeDateAndTime(today, today.getHours(), today.getMinutes()),
    );
  };

  const handleClear = () => {
    onChange(null);

    setDraftValue(null);

    setAnchorEl(null);
  };

  const handleApply = () => {
    if (!draftValue) {
      return;
    }

    onChange(draftValue);

    setAnchorEl(null);
  };

  return (
    <>
      <PickerField
        ref={fieldRef}
        label={label}
        value={value ? formatDateTime(value) : ""}
        placeholder={placeholder}
        error={error}
        helperText={helperText}
        disabled={disabled}
        fullWidth
        onClick={handleFieldClick}
        slotProps={{
          input: {
            readOnly: true,

            endAdornment: (
              <PickerInputButton
                type="button"
                disabled={disabled}
                aria-label={`Open ${label}`}
                onClick={(event) => {
                  event.stopPropagation();

                  if (disabled) {
                    return;
                  }

                  openPicker();
                }}
              >
                <CalendarMonthRounded fontSize="small" />
              </PickerInputButton>
            ),
          },
        }}
      />

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={closePicker}
        anchorOrigin={{
          vertical: "bottom",

          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",

          horizontal: "left",
        }}
        slotProps={{
          paper: {
            elevation: 0,
          },
        }}
      >
        <PickerSurface>
          <PickerBody>
            <CalendarSection>
              <DayPicker
                mode="single"
                selected={draftValue ?? undefined}
                onSelect={handleDaySelect}
                showOutsideDays
                weekStartsOn={1}
                disabled={disabledDays}
                classNames={{
                  root: "lumos-rdp-root",

                  months: "lumos-rdp-months",

                  month: "lumos-rdp-month",

                  month_caption: "lumos-rdp-month-caption",

                  caption_label: "lumos-rdp-caption-label",

                  nav: "lumos-rdp-nav",

                  button_previous: "lumos-rdp-previous",

                  button_next: "lumos-rdp-next",

                  chevron: "lumos-rdp-chevron",

                  month_grid: "lumos-rdp-month-grid",

                  weekdays: "lumos-rdp-weekdays",

                  weekday: "lumos-rdp-weekday",

                  weeks: "lumos-rdp-weeks",

                  week: "lumos-rdp-week",

                  day: "lumos-rdp-day",

                  day_button: "lumos-rdp-day-button",

                  selected: "lumos-rdp-selected",

                  today: "lumos-rdp-today",

                  outside: "lumos-rdp-outside",

                  disabled: "lumos-rdp-disabled",
                }}
              />
            </CalendarSection>

            <TimeSection>
              <TimeTitle>Time</TimeTitle>

              <TimeFields>
                <TimeColumn>
                  <TimeLabel>Hour</TimeLabel>

                  <TimeSelect
                    value={selectedHours}
                    MenuProps={{
                      disablePortal: true,
                      className: "lumos-time-menu",
                    }}
                    onChange={(event) =>
                      handleHourChange(Number(event.target.value))
                    }
                  >
                    {hours.map((hour) => (
                      <MenuItem key={hour} value={hour}>
                        {String(hour).padStart(2, "0")}
                      </MenuItem>
                    ))}
                  </TimeSelect>
                </TimeColumn>

                <TimeColumn>
                  <TimeLabel>Minute</TimeLabel>

                  <TimeSelect
                    value={selectedMinutes}
                    MenuProps={{
                      disablePortal: true,
                      className: "lumos-time-menu",
                    }}
                    onChange={(event) =>
                      handleMinuteChange(Number(event.target.value))
                    }
                  >
                    {minutes.map((minute) => (
                      <MenuItem key={minute} value={minute}>
                        {String(minute).padStart(2, "0")}
                      </MenuItem>
                    ))}
                  </TimeSelect>
                </TimeColumn>
              </TimeFields>

              <SelectedPreview>
                <PreviewLabel>Selected</PreviewLabel>

                <PreviewValue>
                  {draftValue ? formatPreview(draftValue) : "Choose a date"}
                </PreviewValue>
              </SelectedPreview>
            </TimeSection>
          </PickerBody>

          <PickerFooter>
            <FooterLeft>
              {clearable && value ? (
                <SubtleButton
                  type="button"
                  startIcon={<CloseRounded fontSize="small" />}
                  onClick={handleClear}
                >
                  Clear
                </SubtleButton>
              ) : null}

              <SubtleButton type="button" onClick={handleToday}>
                Today
              </SubtleButton>
            </FooterLeft>

            <FooterRight>
              <SubtleButton type="button" onClick={closePicker}>
                Cancel
              </SubtleButton>

              <BrandButton
                type="button"
                variant="contained"
                disabled={!draftValue}
                onClick={handleApply}
              >
                Apply
              </BrandButton>
            </FooterRight>
          </PickerFooter>
        </PickerSurface>
      </Popover>
    </>
  );
}
