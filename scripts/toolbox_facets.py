"""Named Python conveniences over the native facet dispatch allowlists."""

from __future__ import annotations


class Facet:
    def __init__(self, client, name: str):
        self.client, self.name = client, name

    def call(self, method: str, session: str, **arguments):
        return self.client.call(self.name + "." + method, session, arguments)

    def snapshot(self, session: str):
        return self.call("snapshot", session)

    def close(self, session: str):
        return self.call("close", session)


class Weekends(Facet):
    def restore(self, session: str, snapshot: dict):
        return self.call("restore", session, snapshot=snapshot)

    def create(self, session: str, configuration: dict):
        return self.call("create", session, configuration=configuration)

    def command(self, session: str, action: str, payload: dict | None = None):
        return self.call(
            "command", session, action=action, payload={} if payload is None else payload
        )

    def query(self, session: str, view: str = "state", parameters: dict | None = None):
        return self.call(
            "query", session, view=view, parameters={} if parameters is None else parameters
        )

    def step_ticks(self, session: str, count: int):
        return self.call("step_ticks", session, count=count)

    def advance_elapsed(self, session: str, seconds: float):
        return self.call("advance_elapsed", session, seconds=seconds)

    def recording(self, session: str):
        return self.call("recording", session)

    def events(self, session: str):
        return self.call("events", session)


class Campaigns(Facet):
    def restore(self, session: str, snapshot: dict):
        return self.call("restore", session, snapshot=snapshot)

    def create(self, session: str, campaign_id: str):
        return self.call("create", session, campaign_id=campaign_id)

    def query(self, session: str, view: str = "overview", parameters: dict | None = None):
        return self.call(
            "query", session, view=view, parameters={} if parameters is None else parameters
        )

    def command(self, session: str, action: str, payload: dict | None = None):
        return self.call(
            "command", session, action=action, payload={} if payload is None else payload
        )

    def advance(self, session: str):
        return self.call("advance", session)

    def depart(self, session: str, weekend_session: str):
        return self.call("depart", session, weekend_session=weekend_session)

    def settle(self, session: str, weekend_session: str):
        return self.call("settle", session, weekend_session=weekend_session)


class Tracks(Facet):
    def create(self, session: str, configuration: dict | None = None):
        return self.call(
            "create", session, configuration={} if configuration is None else configuration
        )

    def read(self, session: str):
        return self.call("read", session)

    def validate(self, session: str, publication: bool = False):
        return self.call("validate", session, publication=publication)

    def commit(self, session: str, document: dict, expected_revision: int):
        return self.call("commit", session, document=document, expected_revision=expected_revision)

    def edit(self, session: str, action: str, parameters: dict, expected_revision: int):
        return self.call(
            "edit",
            session,
            action=action,
            parameters=parameters,
            expected_revision=expected_revision,
        )

    def undo(self, session: str):
        return self.call("undo", session)

    def redo(self, session: str):
        return self.call("redo", session)

    def cancel(self, session: str):
        return self.call("cancel", session)

    def compile(self, session: str, vehicle: str = "core.vehicle.formula", fast: bool = False):
        return self.call("compile", session, vehicle=vehicle, fast=fast)
