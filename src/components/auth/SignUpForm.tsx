import React, { useState } from "react";
import { Mail, Lock, UserPlus, MapPin, Home, Ruler } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";

const MIN_PASSWORD_LENGTH = 6;

interface Props {
  serverError?: string | null;
}

export default function SignUpForm({ serverError }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [city, setCity] = useState("");
  const [gardenName, setGardenName] = useState("");
  const [gardenWidth, setGardenWidth] = useState("");
  const [gardenHeight, setGardenHeight] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    city?: string;
    gardenName?: string;
    gardenWidth?: string;
    gardenHeight?: string;
  }>({});

  function validate() {
    const next: typeof errors = {};

    if (!email.trim()) {
      next.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Enter a valid email address";
    }

    if (!password) {
      next.password = "Password is required";
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }

    if (!confirmPassword) {
      next.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      next.confirmPassword = "Passwords do not match";
    }

    // City validation
    if (!city.trim()) {
      next.city = "City is required";
    } else if (city.length < 2 || city.length > 100) {
      next.city = "City name must be between 2 and 100 characters";
    }

    // Garden name validation (required)
    if (!gardenName.trim()) {
      next.gardenName = "Garden name is required";
    } else if (gardenName.length > 100) {
      next.gardenName = "Garden name must be at most 100 characters";
    }

    // Garden width validation
    if (!gardenWidth.trim()) {
      next.gardenWidth = "Garden width is required";
    } else {
      const width = Number.parseFloat(gardenWidth);
      if (Number.isNaN(width)) {
        next.gardenWidth = "Enter a valid number";
      } else if (width < 0.1 || width > 100) {
        next.gardenWidth = "Width must be between 0.1 and 100 meters";
      }
    }

    // Garden height validation
    if (!gardenHeight.trim()) {
      next.gardenHeight = "Garden height is required";
    } else {
      const height = Number.parseFloat(gardenHeight);
      if (Number.isNaN(height)) {
        next.gardenHeight = "Enter a valid number";
      } else if (height < 0.1 || height > 100) {
        next.gardenHeight = "Height must be between 0.1 and 100 meters";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  const passwordHint =
    !errors.password && password.length > 0 && password.length < MIN_PASSWORD_LENGTH ? (
      <p className="text-muted-foreground mt-1 text-xs">
        {MIN_PASSWORD_LENGTH - password.length} more character
        {MIN_PASSWORD_LENGTH - password.length !== 1 ? "s" : ""} needed
      </p>
    ) : undefined;

  return (
    <form method="POST" action="/api/auth/signup" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="email"
        type="email"
        label="Email"
        value={email}
        onChange={(v) => {
          setEmail(v);
          clearError("email");
        }}
        placeholder="you@example.com"
        error={errors.email}
        icon={<Mail className="size-4" />}
      />

      <FormField
        id="password"
        label="Password"
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={(v) => {
          setPassword(v);
          clearError("password");
        }}
        placeholder="Min. 6 characters"
        error={errors.password}
        hint={passwordHint}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            visible={showPassword}
            onToggle={() => {
              setShowPassword(!showPassword);
            }}
          />
        }
      />

      <FormField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm password"
        type={showConfirmPassword ? "text" : "password"}
        value={confirmPassword}
        onChange={(v) => {
          setConfirmPassword(v);
          clearError("confirmPassword");
        }}
        placeholder="Re-enter your password"
        error={errors.confirmPassword}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            visible={showConfirmPassword}
            onToggle={() => {
              setShowConfirmPassword(!showConfirmPassword);
            }}
          />
        }
      />

      <FormField
        id="city"
        label="City"
        value={city}
        onChange={(v) => {
          setCity(v);
          clearError("city");
        }}
        placeholder="e.g., Warsaw"
        error={errors.city}
        icon={<MapPin className="size-4" />}
      />

      <FormField
        id="gardenName"
        name="garden_name"
        label="Garden name"
        value={gardenName}
        onChange={(v) => {
          setGardenName(v);
          clearError("gardenName");
        }}
        placeholder="e.g., My Garden, Balcony"
        error={errors.gardenName}
        hint={
          !errors.gardenName && <p className="text-muted-foreground mt-1 text-xs">Give your garden a friendly name</p>
        }
        icon={<Home className="size-4" />}
      />

      <FormField
        id="gardenWidth"
        name="garden_width"
        label="Garden width (0.1-100 m)"
        type="number"
        value={gardenWidth}
        onChange={(v) => {
          setGardenWidth(v);
          clearError("gardenWidth");
        }}
        placeholder="e.g., 5.5"
        error={errors.gardenWidth}
        hint={
          !errors.gardenWidth && <p className="text-muted-foreground mt-1 text-xs">Width of your garden in meters</p>
        }
        icon={<Ruler className="size-4" />}
        min="0.1"
        max="100"
        step="0.1"
      />

      <FormField
        id="gardenHeight"
        name="garden_height"
        label="Garden height (0.1-100 m)"
        type="number"
        value={gardenHeight}
        onChange={(v) => {
          setGardenHeight(v);
          clearError("gardenHeight");
        }}
        placeholder="e.g., 8.0"
        error={errors.gardenHeight}
        hint={
          !errors.gardenHeight && <p className="text-muted-foreground mt-1 text-xs">Height of your garden in meters</p>
        }
        icon={<Ruler className="size-4" />}
        min="0.1"
        max="100"
        step="0.1"
      />

      <ServerError message={serverError} />

      <SubmitButton pendingText="Creating account..." icon={<UserPlus className="size-4" />}>
        Create account
      </SubmitButton>
    </form>
  );
}
