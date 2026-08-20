verify failed: git diff --name-only HEAD | grep -v '^packages/cli/test/' | grep -v '^.fable-opus/' | wc -l | grep -qx '0' && echo TESTS-ONLY (exit 1)

Output tail:
