# Complete your first race weekend

This tutorial takes you through a short, dry standalone weekend in the default
**Minimal** interface. You will release both drivers, record practice and
qualifying laps, approve the race start, try a driving order and review the
final classification. Finishing the flow is the goal; a podium is not required.

## Before you begin

Use a standalone application build or open the source project in **Godot 4.7.2
Standard**. For source, import the root `project.godot`, wait for script import,
then press **F5**. The game needs no runtime account or asset download. For build
packaging and evidence, see [standalone validation](../how-to/standalone-validation.md).

You need a desktop mouse and keyboard. If you previously selected Advanced, open
**Settings → Race interface**, choose **Minimal**, then **Apply** and return to
the main menu. That choice applies when a weekend screen next opens.

## 1. Review a short weekend

1. Choose **Grand Prix Weekend**.
2. Select **Pinecrest Motor Park**, leave the car at its default, select **Dry**,
   and set **Race laps** to **3**.
3. Choose **Review weekend**. Check the circuit, weather and distance on the
   welcome screen.
4. Choose **Start practice** to commit the new weekend. The previous standalone
   weekend is replaced only after the new entry is saved successfully.

You should now see a timing tower on the left, the circuit in the centre, driver
controls on the right and two read-only driver cards below. The player drivers
are **MER** and **MOR**; their timing rows have `*` markers.

## 2. Run both drivers in practice

1. Select **MER**, then choose **Send out**.
2. Select **MOR**, then choose **Send out**.
3. Choose **Play** if the session is paused. Use **4×** for a faster first run.
4. Watch each car leave the garage, complete two measured laps and physically
   return. Wait until both are back in the garage.
5. Choose **End practice**.

The timing tower should contain actual practice times. **Send out** releases a
car; **Play** moves time. Releasing a car while paused does not start playback.
Ending practice closes new runs and lets an already-started measured lap finish
before cars return. The next session waits for your approval.

## 3. Set the qualifying grid

1. Choose **Start qualifying**.
2. Select each driver and choose **Send out** once. Choose **Play** if paused.
3. Wait for the out lap, flying lap and in lap. Each driver's best valid flying
   lap appears in the timing tower.
4. When both return, choose **End qualifying**.

Qualifying closes new attempts and allows a flying lap already in progress to
finish. When physical returns are complete, the next action is **Start formation**.
An individual **Box this lap** call during practice or qualifying abandons an
unfinished timed lap, so leave that control alone for this first run.

## 4. Approve formation and the race start

1. Choose **Start formation**. The game selects usable starting tyre sets from
   real stock for the observed conditions.
2. Let the cars complete the physical formation lap and stop in their grid slots.
   Use **Play** if necessary. Formation does not count as a race lap.
3. When **Start race** becomes available, choose it.
4. Watch the starting lights, then the race.

The toolbar now shows race progress. Live gaps marked `~` are estimates. The
final classification will use completed race facts.

## 5. Try one order and finish

1. Select **MER** and choose **Push**. Read the small acceptance message and
   confirm the current pace order in MER's bottom card.
2. Choose **Push** again to return to Normal. **Push** and **Calm** are persistent
   orders until changed; they are not one-lap boosts.
3. Leave the engine in **Standard** and allow the three-lap race to finish.
4. Choose **Review weekend** when it appears. On **Weekend complete**, inspect
   both managed drivers' results and the final classification.

You have completed practice, qualifying, formation, lights and a race over one
weekend. You can choose **Main menu**, **Review final track**, or **New weekend**
from the completion screen.

## Keep playing

**Space** toggles play/pause; **1–5** select 1×, 2×, 4×, 8× and 16×. The mouse
wheel zooms the circuit, middle-drag pans, and **F** fits it. **Menu** pauses and
saves; **Continue Weekend** resumes the retained checkpoint. A restored active
session opens paused.

For a next learning exercise, follow [your first campaign](first-campaign.md).
For a specific editing task, [save and test a custom circuit](../how-to/first-circuit.md).
Use [troubleshooting](../how-to/troubleshooting.md) if import, controls or persistence fail.
The [Minimal contract](../reference/race-weekend/minimal.md) is the reference for control
availability, finite tyre selection and the read-only **Strategy** comparison.
