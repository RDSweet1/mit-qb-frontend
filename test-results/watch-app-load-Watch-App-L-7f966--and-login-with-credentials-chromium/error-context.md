# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - alert [ref=e2]
  - generic [ref=e4]:
    - generic [ref=e5]:
      - img [ref=e7]
      - heading "MIT Consulting" [level=1] [ref=e10]
      - paragraph [ref=e11]: QuickBooks Timesheet System
    - paragraph [ref=e13]:
      - strong [ref=e14]: "Internal Use Only:"
      - text: This application is exclusively for MIT Consulting employees.
    - button [disabled] [ref=e15]
    - paragraph [ref=e18]:
      - text: By signing in, you agree to the
      - link "EULA & Privacy Policy" [ref=e19] [cursor=pointer]:
        - /url: /eula
```