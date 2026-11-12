"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"

type PasswordInputProps = Omit<React.ComponentProps<typeof InputGroupInput>, "type">

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, disabled, id, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false)

    return (
      <InputGroup className={className}>
        <InputGroupInput
          {...props}
          ref={ref}
          id={id}
          type={visible ? "text" : "password"}
          disabled={disabled}
        />
        <InputGroupAddon align="inline-end">
        <InputGroupButton
          type="button"
          size="icon-sm"
          disabled={disabled}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={id}
          title={visible ? "Hide password" : "Show password"}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    )
  },
)

PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
